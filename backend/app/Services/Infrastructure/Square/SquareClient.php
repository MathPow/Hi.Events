<?php

namespace HiEvents\Services\Infrastructure\Square;

use HiEvents\DomainObjects\Enums\SquareEnvironment;
use HiEvents\Exceptions\Square\SquareApiException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Http\Client\Response;
use Psr\Log\LoggerInterface;

/**
 * Client REST minimal pour l'API Square.
 *
 * Choix assume: pas de dependance sur le SDK officiel square/square. Les quelques
 * points d'API dont la billetterie a besoin (payments, refunds, locations, oauth)
 * tiennent en une centaine de lignes, alors que le SDK ajoute une dependance
 * lourde qu'il faudrait re-arbitrer a chaque rebase sur l'upstream Hi.Events.
 */
class SquareClient
{
    public function __construct(
        private readonly HttpFactory       $http,
        private readonly LoggerInterface   $logger,
        private readonly SquareEnvironment $environment,
        private readonly string            $apiVersion,
        private readonly ?string           $accessToken = null,
    )
    {
    }

    public function getEnvironment(): SquareEnvironment
    {
        return $this->environment;
    }

    /**
     * @throws SquareApiException
     */
    public function createPayment(array $payload): array
    {
        return $this->request('POST', '/v2/payments', $payload);
    }

    /**
     * @throws SquareApiException
     */
    public function getPayment(string $paymentId): array
    {
        return $this->request('GET', "/v2/payments/{$paymentId}");
    }

    /**
     * @throws SquareApiException
     */
    public function refundPayment(array $payload): array
    {
        return $this->request('POST', '/v2/refunds', $payload);
    }

    /**
     * @throws SquareApiException
     */
    public function getRefund(string $refundId): array
    {
        return $this->request('GET', "/v2/refunds/{$refundId}");
    }

    /**
     * @throws SquareApiException
     */
    public function listLocations(): array
    {
        return $this->request('GET', '/v2/locations');
    }

    /**
     * @throws SquareApiException
     */
    public function retrieveMerchant(string $merchantId): array
    {
        return $this->request('GET', "/v2/merchants/{$merchantId}");
    }

    /**
     * Les appels OAuth ne portent pas le jeton du marchand mais le secret de
     * l'application, d'ou la signature separee.
     *
     * @throws SquareApiException
     */
    public function oauthToken(array $payload, string $applicationSecret): array
    {
        return $this->send(
            method: 'POST',
            path: '/oauth2/token',
            payload: $payload,
            headers: ['Square-Version' => $this->apiVersion, 'Authorization' => 'Client ' . $applicationSecret],
        );
    }

    /**
     * @throws SquareApiException
     */
    public function revokeToken(array $payload, string $applicationSecret): array
    {
        return $this->send(
            method: 'POST',
            path: '/oauth2/revoke',
            payload: $payload,
            headers: ['Square-Version' => $this->apiVersion, 'Authorization' => 'Client ' . $applicationSecret],
        );
    }

    /**
     * @throws SquareApiException
     */
    private function request(string $method, string $path, array $payload = []): array
    {
        if ($this->accessToken === null) {
            throw new SquareApiException(__('No Square access token is available for this request.'));
        }

        return $this->send($method, $path, $payload, [
            'Square-Version' => $this->apiVersion,
            'Authorization' => 'Bearer ' . $this->accessToken,
        ]);
    }

    /**
     * @throws SquareApiException
     */
    private function send(string $method, string $path, array $payload, array $headers): array
    {
        $url = $this->environment->apiBaseUrl() . $path;

        try {
            $request = $this->http
                ->withHeaders($headers + ['Accept' => 'application/json'])
                ->timeout(30)
                // Un echec reseau transitoire ne doit pas se traduire par un paiement
                // perdu. Les appels d'ecriture portent une cle d'idempotence, donc
                // rejouer est sans danger.
                ->retry(2, 250, throw: false);

            $response = $method === 'GET'
                ? $request->get($url, $payload)
                : $request->send($method, $url, ['json' => $payload]);
        } catch (ConnectionException $exception) {
            $this->logger->error('Square API connection failure: ' . $exception->getMessage(), [
                'url' => $url,
                'method' => $method,
            ]);

            throw new SquareApiException(
                __('There was an error communicating with the payment provider. Please try again later.')
            );
        }

        return $this->decode($response, $method, $url);
    }

    /**
     * @throws SquareApiException
     */
    private function decode(Response $response, string $method, string $url): array
    {
        $body = $response->json() ?? [];

        if ($response->successful() && !isset($body['errors'])) {
            return $body;
        }

        $errors = $body['errors'] ?? [];
        $detail = $errors[0]['detail'] ?? __('Unknown Square error');

        $this->logger->error('Square API error: ' . $detail, [
            'url' => $url,
            'method' => $method,
            'status' => $response->status(),
            'errors' => $errors,
        ]);

        $exception = new SquareApiException($detail);
        $exception->squareErrors = $errors;

        throw $exception;
    }
}
