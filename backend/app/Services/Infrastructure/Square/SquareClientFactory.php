<?php

namespace HiEvents\Services\Infrastructure\Square;

use HiEvents\DomainObjects\AccountSquareCredentialDomainObject;
use HiEvents\DomainObjects\Enums\SquareEnvironment;
use HiEvents\Exceptions\Square\SquareClientConfigurationException;
use Illuminate\Http\Client\Factory as HttpFactory;
use Psr\Log\LoggerInterface;

class SquareClientFactory
{
    public function __construct(
        private readonly HttpFactory                $http,
        private readonly LoggerInterface            $logger,
        private readonly SquareConfigurationService $configurationService,
    )
    {
    }

    /**
     * Client agissant au nom d'un marchand connecte. Sans credential (ou sans
     * jeton dedans), on retombe sur le jeton d'application defini en
     * environnement, ce qui couvre l'installation mono-marchand.
     *
     * @throws SquareClientConfigurationException
     */
    public function createForCredential(?AccountSquareCredentialDomainObject $credential = null): SquareClient
    {
        $accessToken = $credential?->getAccessToken() ?: $this->configurationService->getFallbackAccessToken();

        if (empty($accessToken)) {
            throw new SquareClientConfigurationException(
                __('No Square access token is configured. Connect a Square account first.')
            );
        }

        return new SquareClient(
            http: $this->http,
            logger: $this->logger,
            environment: $credential?->getEnvironmentEnum() ?? $this->configurationService->getEnvironment(),
            apiVersion: $this->configurationService->getApiVersion(),
            accessToken: $accessToken,
        );
    }

    /**
     * Client sans jeton marchand, reserve aux echanges OAuth qui s'authentifient
     * avec le secret de l'application.
     */
    public function createUnauthenticated(?SquareEnvironment $environment = null): SquareClient
    {
        return new SquareClient(
            http: $this->http,
            logger: $this->logger,
            environment: $environment ?? $this->configurationService->getEnvironment(),
            apiVersion: $this->configurationService->getApiVersion(),
            accessToken: null,
        );
    }
}
