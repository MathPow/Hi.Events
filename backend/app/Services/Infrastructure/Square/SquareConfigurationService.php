<?php

namespace HiEvents\Services\Infrastructure\Square;

use HiEvents\DomainObjects\Enums\SquareEnvironment;
use Illuminate\Config\Repository;

class SquareConfigurationService
{
    public function __construct(private readonly Repository $config)
    {
    }

    public function getApplicationId(): ?string
    {
        return $this->config->get('services.square.application_id');
    }

    public function getApplicationSecret(): ?string
    {
        return $this->config->get('services.square.application_secret');
    }

    public function getWebhookSignatureKey(): ?string
    {
        return $this->config->get('services.square.webhook_signature_key');
    }

    public function getApiVersion(): string
    {
        return $this->config->get('services.square.api_version', '2025-01-23');
    }

    public function getEnvironment(): SquareEnvironment
    {
        return SquareEnvironment::tryFrom(
            (string)$this->config->get('services.square.environment', 'production')
        ) ?? SquareEnvironment::PRODUCTION;
    }

    /**
     * Jeton de repli pour une installation mono-marchand qui ne passe pas par
     * OAuth. En mode SaaS c'est le jeton du marchand connecte qui prime.
     */
    public function getFallbackAccessToken(): ?string
    {
        return $this->config->get('services.square.access_token');
    }

    public function getFallbackLocationId(): ?string
    {
        return $this->config->get('services.square.location_id');
    }

    /**
     * L'OAuth n'a de sens que si la plateforme a declare son application Square.
     * Sans ces deux valeurs, seul le mode mono-marchand est possible.
     */
    public function isOAuthConfigured(): bool
    {
        return !empty($this->getApplicationId()) && !empty($this->getApplicationSecret());
    }

    public function isConfigured(): bool
    {
        return $this->isOAuthConfigured() || !empty($this->getFallbackAccessToken());
    }
}
