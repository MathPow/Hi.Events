<?php

namespace HiEvents\Services\Infrastructure\Anthropic;

use Anthropic\Client;
use Illuminate\Config\Repository;

class AnthropicClientFactory
{
    public function __construct(
        private readonly Repository $config,
    )
    {
    }

    public function isConfigured(): bool
    {
        return trim((string)$this->config->get('services.anthropic.api_key')) !== '';
    }

    public function create(): Client
    {
        return new Client(apiKey: (string)$this->config->get('services.anthropic.api_key'));
    }
}
