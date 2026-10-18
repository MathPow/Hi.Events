<?php

declare(strict_types=1);

namespace HiEvents\Services\Infrastructure\Turnstile;

use Illuminate\Config\Repository;
use Illuminate\Http\Client\Factory as HttpClient;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Verifie aupres de Cloudflare le jeton du widget Turnstile. Tant que
 * TURNSTILE_SECRET_KEY n'est pas defini, tout jeton est accepte.
 *
 * Si Cloudflare ne repond pas, on refuse: le site passe par Cloudflare, une
 * panne chez eux coupe de toute facon l'inscription.
 */
class TurnstileVerificationService
{
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public function __construct(
        private readonly Repository      $config,
        private readonly HttpClient      $httpClient,
        private readonly LoggerInterface $logger,
    )
    {
    }

    public function isEnabled(): bool
    {
        return trim((string)$this->config->get('services.turnstile.secret_key')) !== '';
    }

    public function verify(?string $token, ?string $ipAddress): bool
    {
        if (!$this->isEnabled()) {
            return true;
        }

        if ($token === null || trim($token) === '') {
            return false;
        }

        try {
            $response = $this->httpClient
                ->asForm()
                ->timeout(5)
                ->post(self::VERIFY_URL, array_filter([
                    'secret' => $this->config->get('services.turnstile.secret_key'),
                    'response' => $token,
                    'remoteip' => $ipAddress,
                ]));
        } catch (Throwable $exception) {
            $this->logger->warning('Turnstile verification could not reach Cloudflare', [
                'exception' => $exception->getMessage(),
            ]);

            return false;
        }

        return $response->successful() && $response->json('success') === true;
    }
}
