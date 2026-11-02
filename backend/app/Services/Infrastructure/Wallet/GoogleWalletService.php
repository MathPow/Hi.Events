<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\Wallet;

use HiEvents\Exceptions\WalletPassFailedException;
use HiEvents\Services\Domain\Wallet\DTO\WalletOrderDTO;
use HiEvents\Services\Domain\Wallet\DTO\WalletTicketDTO;
use HiEvents\Services\Infrastructure\Wallet\DTO\GoogleServiceAccountDTO;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Illuminate\Http\Client\Factory as HttpClient;
use Illuminate\Http\Client\Response;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * The tickets in Google Wallet: the event is a class (title, date, place, the organizer's color,
 * logo and cover), each attendee an object with its QR code. Both are written (or brought up to
 * date) through the API, then a signed link adds the objects to the buyer's wallet.
 * Built in the language of the order: the caller sets it.
 */
class GoogleWalletService
{
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';
    private const API_URL = 'https://walletobjects.googleapis.com/walletobjects/v1';
    private const SAVE_URL = 'https://pay.google.com/gp/v/save/';
    private const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

    public function __construct(
        private readonly WalletConfig       $config,
        private readonly WalletImageService $images,
        private readonly HttpClient         $http,
        private readonly CacheRepository    $cache,
        private readonly LoggerInterface    $logger,
    )
    {
    }

    /**
     * @throws WalletPassFailedException
     */
    public function saveUrl(WalletOrderDTO $order): string
    {
        $account = $this->config->googleServiceAccount();
        $token = $this->accessToken($account);

        $class = $this->eventClass($order);
        $this->upsert('eventTicketClass', $class, $token);

        $objects = [];
        foreach ($order->tickets as $ticket) {
            $object = $this->ticketObject($order, $ticket, $class['id']);
            $this->upsert('eventTicketObject', $object, $token);
            $objects[] = ['id' => $object['id']];
        }

        return self::SAVE_URL . $this->jwt([
                'iss' => $account->clientEmail,
                'aud' => 'google',
                'typ' => 'savetowallet',
                'iat' => time(),
                'origins' => [$this->config->frontendUrl()],
                'payload' => ['eventTicketObjects' => $objects],
            ], $account->privateKey);
    }

    public function eventClass(WalletOrderDTO $order): array
    {
        $event = $order->event;
        $logoUrl = $this->images->publicCircleLogoUrl($event->logo);
        $coverUrl = $this->images->publicCoverUrl($event->cover, 1032, 336);

        return array_filter([
            'id' => $this->resourceId('event-' . $event->eventId),
            'issuerName' => $event->organizerName,
            'reviewStatus' => 'UNDER_REVIEW',
            'eventName' => $this->localized($event->title, $order->locale),
            'hexBackgroundColor' => $event->backgroundColor,
            'logo' => $logoUrl ? $this->image($logoUrl, $event->organizerName, $order->locale) : null,
            'heroImage' => $coverUrl ? $this->image($coverUrl, $event->title, $order->locale) : null,
            'venue' => $event->placeLine ? array_filter([
                'name' => $this->localized($event->placeLine, $order->locale),
                'address' => $event->addressLine ? $this->localized($event->addressLine, $order->locale) : null,
            ]) : null,
            'dateTime' => $event->startDate ? array_filter([
                'start' => $event->startDate,
                'end' => $event->endDate,
            ]) : null,
            'homepageUri' => $event->eventUrl ? [
                'uri' => $event->eventUrl,
                'description' => __('Event page'),
            ] : null,
        ], fn($value) => $value !== null);
    }

    public function ticketObject(WalletOrderDTO $order, WalletTicketDTO $ticket, string $classId): array
    {
        return array_filter([
            'id' => $this->resourceId('ticket-' . $ticket->attendeeId),
            'classId' => $classId,
            'state' => 'ACTIVE',
            'ticketHolderName' => $ticket->holderName ?: null,
            'ticketNumber' => $ticket->publicId,
            'ticketType' => $ticket->ticketName ? $this->localized($ticket->ticketName, $order->locale) : null,
            'reservationInfo' => ['confirmationCode' => $order->orderPublicId],
            'hexBackgroundColor' => $order->event->backgroundColor,
            'barcode' => [
                'type' => 'QR_CODE',
                'value' => $ticket->publicId,
                'alternateText' => $ticket->publicId,
            ],
        ], fn($value) => $value !== null);
    }

    /** Insert, or replace when it exists: the pass follows the event when it changes. */
    private function upsert(string $resource, array $body, string $token): void
    {
        try {
            $response = $this->request($token)->post(self::API_URL . "/$resource", $body);

            if ($response->status() === 409) {
                $response = $this->request($token)->put(self::API_URL . "/$resource/" . rawurlencode($body['id']), $body);
            }
        } catch (Throwable $exception) {
            throw new WalletPassFailedException('Google Wallet: ' . $exception->getMessage(), 0, $exception);
        }

        $this->ensureSuccessful($response, $resource, $body['id']);
    }

    private function accessToken(GoogleServiceAccountDTO $account): string
    {
        return $this->cache->remember('google-wallet-token:' . md5($account->clientEmail), 3000, function () use ($account) {
            $now = time();

            try {
                $response = $this->http->asForm()->timeout(15)->post(self::TOKEN_URL, [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $this->jwt([
                        'iss' => $account->clientEmail,
                        'scope' => self::SCOPE,
                        'aud' => self::TOKEN_URL,
                        'iat' => $now,
                        'exp' => $now + 3600,
                    ], $account->privateKey),
                ]);
            } catch (Throwable $exception) {
                throw new WalletPassFailedException('Google Wallet: ' . $exception->getMessage(), 0, $exception);
            }

            $this->ensureSuccessful($response, 'token', $account->clientEmail);

            return (string)$response->json('access_token');
        });
    }

    private function ensureSuccessful(Response $response, string $resource, string $id): void
    {
        if ($response->successful()) {
            return;
        }

        $this->logger->error('Google Wallet: the request was refused', [
            'resource' => $resource,
            'id' => $id,
            'status' => $response->status(),
            'body' => mb_substr($response->body(), 0, 2000),
        ]);

        throw new WalletPassFailedException("Google Wallet: $resource refused ({$response->status()})");
    }

    private function request(string $token)
    {
        return $this->http->withToken($token)->acceptJson()->timeout(15);
    }

    private function jwt(array $claims, string $privateKey): string
    {
        $segments = [
            $this->base64Url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])),
            $this->base64Url(json_encode($claims, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)),
        ];

        $signature = '';
        if (!openssl_sign(implode('.', $segments), $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
            throw new WalletPassFailedException('Google Wallet: the link could not be signed');
        }
        $segments[] = $this->base64Url($signature);

        return implode('.', $segments);
    }

    /** « 3388000000012345678.billets-dehorsqc-com-ticket-42 »: letters, digits, « . », « _ », « - ». */
    private function resourceId(string $suffix): string
    {
        return $this->config->googleIssuerId() . '.' . $this->config->googleResourcePrefix() . '-' . $suffix;
    }

    private function localized(string $value, string $locale): array
    {
        return ['defaultValue' => ['language' => str_replace('_', '-', $locale), 'value' => $value]];
    }

    private function image(string $url, string $description, string $locale): array
    {
        return [
            'sourceUri' => ['uri' => $url],
            'contentDescription' => $this->localized($description, $locale),
        ];
    }

    private function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
