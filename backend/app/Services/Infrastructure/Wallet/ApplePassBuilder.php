<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\Wallet;

use HiEvents\Exceptions\WalletPassFailedException;
use HiEvents\Services\Domain\Wallet\DTO\WalletEventDTO;
use HiEvents\Services\Domain\Wallet\DTO\WalletOrderDTO;
use HiEvents\Services\Domain\Wallet\DTO\WalletTicketDTO;
use HiEvents\Services\Infrastructure\Wallet\DTO\AppleSigningCredentialsDTO;
use HiEvents\Services\Infrastructure\Wallet\DTO\WalletFileDTO;
use Illuminate\Support\Str;
use ZipArchive;

/**
 * The tickets as Apple Wallet passes: one .pkpass per attendee, signed with the certificate of the
 * pass type; several tickets go in one .pkpasses that adds them all at once (iOS 15.5+).
 * Built in the language of the order: the caller sets it.
 */
class ApplePassBuilder
{
    public const MIME_PASS = 'application/vnd.apple.pkpass';
    public const MIME_BUNDLE = 'application/vnd.apple.pkpasses';

    private const LOGO_TEXT_MAX_RATIO = 1.6;

    public function __construct(
        private readonly WalletConfig       $config,
        private readonly WalletImageService $images,
    )
    {
    }

    /**
     * @throws WalletPassFailedException
     */
    public function build(WalletOrderDTO $order): WalletFileDTO
    {
        $credentials = $this->config->appleSigningCredentials();
        $images = $this->images($order->event);
        $baseName = Str::slug($order->event->title) ?: 'billets';
        $ratio = $order->event->logo ? $this->images->aspectRatio($order->event->logo) : null;
        // The organizer's name beside the logo when it fits (no logo, or a squarish one).
        $withLogoText = $order->event->logo === null || ($ratio !== null && $ratio <= self::LOGO_TEXT_MAX_RATIO);

        $passes = array_map(
            fn(WalletTicketDTO $ticket) => $this->pass($order, $ticket, $withLogoText, $images, $credentials),
            $order->tickets,
        );

        if (count($passes) === 1) {
            return new WalletFileDTO(content: $passes[0], mimeType: self::MIME_PASS, filename: $baseName . '.pkpass');
        }

        $files = [];
        foreach ($passes as $index => $pass) {
            $files[sprintf('%s-%d.pkpass', $baseName, $index + 1)] = $pass;
        }

        return new WalletFileDTO(content: $this->zip($files), mimeType: self::MIME_BUNDLE, filename: $baseName . '.pkpasses');
    }

    /** pass.json: the front shows the event, the date, the place, the attendee and the QR code. */
    public function passJson(WalletOrderDTO $order, WalletTicketDTO $ticket, bool $withLogoText): array
    {
        $event = $order->event;

        return array_filter([
            'formatVersion' => 1,
            'passTypeIdentifier' => $this->config->applePassTypeIdentifier(),
            'teamIdentifier' => $this->config->appleTeamIdentifier(),
            'serialNumber' => $ticket->publicId,
            'organizationName' => $event->organizerName,
            'description' => __('Ticket for :event', ['event' => $event->title]),
            'logoText' => $withLogoText ? $event->organizerName : null,
            'backgroundColor' => $this->rgb($event->backgroundColor),
            'foregroundColor' => $this->rgb($event->foregroundColor),
            'labelColor' => $this->rgb($event->labelColor),
            'relevantDate' => $event->startDate,
            'barcodes' => [[
                'format' => 'PKBarcodeFormatQR',
                'message' => $ticket->publicId,
                'messageEncoding' => 'iso-8859-1',
                'altText' => $ticket->publicId,
            ]],
            'eventTicket' => array_filter([
                'headerFields' => $this->fields([
                    ['key' => 'date', 'label' => __('Date'), 'value' => $event->shortDate],
                ]),
                'primaryFields' => $this->fields([
                    ['key' => 'event', 'label' => __('Event'), 'value' => $event->title],
                ]),
                'secondaryFields' => $this->fields([
                    ['key' => 'when', 'label' => __('When'), 'value' => $event->dateTimeLine],
                    ['key' => 'where', 'label' => __('Where'), 'value' => $event->placeLine, 'textAlignment' => 'PKTextAlignmentRight'],
                ]),
                'auxiliaryFields' => $this->fields([
                    ['key' => 'attendee', 'label' => __('Attendee'), 'value' => $ticket->holderName],
                    ['key' => 'ticket', 'label' => __('Ticket'), 'value' => $ticket->ticketName, 'textAlignment' => 'PKTextAlignmentRight'],
                ]),
                'backFields' => $this->fields([
                    ['key' => 'date-full', 'label' => __('Date'), 'value' => $this->lines($event->dateLine, $event->timezoneLine)],
                    ['key' => 'address', 'label' => __('Address'), 'value' => $this->lines($event->placeLine, $event->addressLine)],
                    ['key' => 'ticket-number', 'label' => __('Ticket number'), 'value' => $ticket->publicId],
                    ['key' => 'order', 'label' => __('Order'), 'value' => $order->orderPublicId],
                    ['key' => 'organizer', 'label' => __('Organizer'), 'value' => $this->lines($event->organizerName, $event->supportEmail)],
                    ['key' => 'event-page', 'label' => __('Event page'), 'value' => $event->eventUrl],
                    ['key' => 'platform', 'label' => '', 'value' => __('Ticket issued by :platform', ['platform' => 'Billetterie Dehors'])],
                ]),
            ]),
        ], fn($value) => $value !== null);
    }

    /** @return array<string, string> file name => PNG */
    private function images(WalletEventDTO $event): array
    {
        $images = [];
        foreach ([1 => 'icon.png', 2 => 'icon@2x.png', 3 => 'icon@3x.png'] as $scale => $name) {
            $images[$name] = $this->images->platformIcon(29 * $scale);
        }

        foreach ([1 => 'logo.png', 2 => 'logo@2x.png', 3 => 'logo@3x.png'] as $scale => $name) {
            $logo = $event->logo
                ? $this->images->contain($event->logo, 160 * $scale, 50 * $scale)
                : $this->images->platformIcon(50 * $scale);
            if ($logo !== null) {
                $images[$name] = $logo;
            }
        }

        foreach ([1 => 'thumbnail.png', 2 => 'thumbnail@2x.png', 3 => 'thumbnail@3x.png'] as $scale => $name) {
            $thumbnail = $this->images->cover($event->cover, 90 * $scale, 90 * $scale);
            if ($thumbnail !== null) {
                $images[$name] = $thumbnail;
            }
        }

        return $images;
    }

    private function pass(
        WalletOrderDTO             $order,
        WalletTicketDTO            $ticket,
        bool                       $withLogoText,
        array                      $images,
        AppleSigningCredentialsDTO $credentials,
    ): string
    {
        $files = [
            'pass.json' => json_encode(
                $this->passJson($order, $ticket, $withLogoText),
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
            ),
            ...$images,
        ];

        $manifest = json_encode(array_map('sha1', $files), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $files['manifest.json'] = $manifest;
        $files['signature'] = $this->sign($manifest, $credentials);

        return $this->zip($files);
    }

    /** The detached signature (DER) of the manifest, with Apple's intermediate certificate. */
    private function sign(string $manifest, AppleSigningCredentialsDTO $credentials): string
    {
        $manifestPath = $this->temporaryFile();
        $signaturePath = $this->temporaryFile();

        try {
            file_put_contents($manifestPath, $manifest);

            $signed = openssl_cms_sign(
                $manifestPath,
                $signaturePath,
                $credentials->certificate,
                $credentials->privateKey,
                [],
                OPENSSL_CMS_BINARY | OPENSSL_CMS_DETACHED,
                OPENSSL_ENCODING_DER,
                $this->config->appleIntermediateCertificatePath(),
            );

            if (!$signed) {
                throw new WalletPassFailedException('Apple Wallet: the pass could not be signed (' . openssl_error_string() . ')');
            }

            return (string)file_get_contents($signaturePath);
        } finally {
            @unlink($manifestPath);
            @unlink($signaturePath);
        }
    }

    /** @param array<string, string> $files */
    private function zip(array $files): string
    {
        $path = $this->temporaryFile();
        $zip = new ZipArchive();

        try {
            if ($zip->open($path, ZipArchive::OVERWRITE) !== true) {
                throw new WalletPassFailedException('Apple Wallet: the pass could not be packed');
            }
            foreach ($files as $name => $content) {
                $zip->addFromString($name, $content);
            }
            $zip->close();

            return (string)file_get_contents($path);
        } finally {
            @unlink($path);
        }
    }

    private function fields(array $fields): array
    {
        return array_values(array_filter(
            $fields,
            fn(array $field) => is_string($field['value'] ?? null) && trim($field['value']) !== '',
        ));
    }

    private function lines(?string ...$lines): ?string
    {
        $lines = array_filter($lines, fn(?string $line) => $line !== null && trim($line) !== '');

        return $lines ? implode("\n", $lines) : null;
    }

    private function rgb(string $hex): string
    {
        [$r, $g, $b] = sscanf($hex, '#%02x%02x%02x');

        return "rgb($r, $g, $b)";
    }

    private function temporaryFile(): string
    {
        return (string)tempnam(sys_get_temp_dir(), 'wallet');
    }
}
