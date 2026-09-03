<?php

namespace HiEvents\Services\Domain\Payment\Square;

use Carbon\Carbon;
use HiEvents\DomainObjects\AccountSquareCredentialDomainObject;
use HiEvents\DomainObjects\Generated\AccountSquareCredentialDomainObjectAbstract;
use HiEvents\Exceptions\Square\SquareApiException;
use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Repository\Interfaces\AccountSquareCredentialRepositoryInterface;
use HiEvents\Services\Infrastructure\Square\SquareClientFactory;
use HiEvents\Services\Infrastructure\Square\SquareConfigurationService;
use Psr\Log\LoggerInterface;

/**
 * Autorisation d'un compte marchand Square par la plateforme.
 *
 * Equivalent fonctionnel de Stripe Connect: l'organisateur autorise l'application,
 * la plateforme conserve un jeton qui lui permet d'encaisser sur le compte du
 * marchand. L'argent va directement chez lui; la plateforme ne fait que prelever
 * sa part via app_fee_money.
 */
class SquareOAuthService
{
    /**
     * Permissions minimales: encaisser, rembourser, lire les points de vente et
     * l'identite du marchand. Demander plus ferait echouer l'autorisation chez
     * les marchands prudents sans rien apporter a la billetterie.
     */
    public const REQUIRED_SCOPES = [
        'MERCHANT_PROFILE_READ',
        'PAYMENTS_WRITE',
        'PAYMENTS_READ',
        'ORDERS_WRITE',
        'ORDERS_READ',
    ];

    public function __construct(
        private readonly SquareClientFactory                        $clientFactory,
        private readonly SquareConfigurationService                 $configurationService,
        private readonly AccountSquareCredentialRepositoryInterface $credentialRepository,
        private readonly LoggerInterface                            $logger,
    )
    {
    }

    /**
     * @throws SquareOAuthException
     */
    public function buildAuthorizeUrl(string $state): string
    {
        if (!$this->configurationService->isOAuthConfigured()) {
            throw new SquareOAuthException(
                __('Square OAuth is not configured on this installation.')
            );
        }

        $environment = $this->configurationService->getEnvironment();

        $query = http_build_query([
            'client_id' => $this->configurationService->getApplicationId(),
            'scope' => implode(' ', self::REQUIRED_SCOPES),
            'session' => 'false',
            'state' => $state,
        ]);

        return $environment->apiBaseUrl() . '/oauth2/authorize?' . $query;
    }

    /**
     * Echange le code d'autorisation contre un jeu de jetons et enregistre le
     * marchand. Le point de vente n'est pas choisi ici: un marchand peut en avoir
     * plusieurs, c'est a lui de trancher dans l'interface.
     *
     * @throws SquareOAuthException
     */
    public function exchangeCodeForTokens(int $accountId, string $code): AccountSquareCredentialDomainObject
    {
        $environment = $this->configurationService->getEnvironment();
        $client = $this->clientFactory->createUnauthenticated($environment);

        try {
            $response = $client->oauthToken([
                'client_id' => $this->configurationService->getApplicationId(),
                'client_secret' => $this->configurationService->getApplicationSecret(),
                'code' => $code,
                'grant_type' => 'authorization_code',
            ], $this->configurationService->getApplicationSecret());
        } catch (SquareApiException $exception) {
            $this->logger->error('Square OAuth token exchange failed: ' . $exception->getMessage(), [
                'account_id' => $accountId,
            ]);

            throw new SquareOAuthException(
                __('Square refused the authorization: :message', ['message' => $exception->getMessage()])
            );
        }

        return $this->persistTokens($accountId, $environment->value, $response);
    }

    /**
     * @throws SquareOAuthException
     */
    public function refreshTokens(AccountSquareCredentialDomainObject $credential): AccountSquareCredentialDomainObject
    {
        if ($credential->getRefreshToken() === null) {
            throw new SquareOAuthException(
                __('This Square connection has no refresh token. Please reconnect the account.')
            );
        }

        $client = $this->clientFactory->createUnauthenticated($credential->getEnvironmentEnum());

        try {
            $response = $client->oauthToken([
                'client_id' => $this->configurationService->getApplicationId(),
                'client_secret' => $this->configurationService->getApplicationSecret(),
                'refresh_token' => $credential->getRefreshToken(),
                'grant_type' => 'refresh_token',
            ], $this->configurationService->getApplicationSecret());
        } catch (SquareApiException $exception) {
            $this->logger->error('Square OAuth token refresh failed: ' . $exception->getMessage(), [
                'account_id' => $credential->getAccountId(),
            ]);

            throw new SquareOAuthException(
                __('Could not refresh the Square connection. Please reconnect the account.')
            );
        }

        return $this->persistTokens(
            accountId: $credential->getAccountId(),
            environment: $credential->getEnvironment(),
            response: $response,
            existing: $credential,
        );
    }

    /**
     * Un jeton qui expire pendant un checkout ferait echouer le paiement au pire
     * moment: on le renouvelle en amont des qu'il approche de sa fin de vie.
     *
     * @throws SquareOAuthException
     */
    public function ensureFreshTokens(
        ?AccountSquareCredentialDomainObject $credential
    ): ?AccountSquareCredentialDomainObject
    {
        if ($credential === null || !$credential->needsTokenRefresh()) {
            return $credential;
        }

        return $this->refreshTokens($credential);
    }

    public function revoke(AccountSquareCredentialDomainObject $credential): void
    {
        $client = $this->clientFactory->createUnauthenticated($credential->getEnvironmentEnum());

        try {
            $client->revokeToken([
                'client_id' => $this->configurationService->getApplicationId(),
                'merchant_id' => $credential->getMerchantId(),
            ], $this->configurationService->getApplicationSecret());
        } catch (SquareApiException $exception) {
            // Une revocation refusee par Square (jeton deja mort, marchand supprime)
            // ne doit pas empecher de nettoyer notre cote: sinon la connexion reste
            // affichee comme active alors qu'elle ne fonctionne plus.
            $this->logger->warning('Square token revocation failed: ' . $exception->getMessage(), [
                'account_id' => $credential->getAccountId(),
            ]);
        }

        $this->credentialRepository->deleteById($credential->getId());
    }

    private function persistTokens(
        int                                  $accountId,
        string                               $environment,
        array                                $response,
        ?AccountSquareCredentialDomainObject $existing = null,
    ): AccountSquareCredentialDomainObject
    {
        $attributes = [
            AccountSquareCredentialDomainObjectAbstract::MERCHANT_ID => $response['merchant_id'] ?? $existing?->getMerchantId(),
            AccountSquareCredentialDomainObjectAbstract::ACCESS_TOKEN => $response['access_token'] ?? null,
            AccountSquareCredentialDomainObjectAbstract::REFRESH_TOKEN => $response['refresh_token'] ?? $existing?->getRefreshToken(),
            AccountSquareCredentialDomainObjectAbstract::TOKEN_EXPIRES_AT => isset($response['expires_at'])
                ? Carbon::parse($response['expires_at'])
                : null,
            AccountSquareCredentialDomainObjectAbstract::SCOPES => self::REQUIRED_SCOPES,
        ];

        $existing ??= $this->credentialRepository->findFirstWhere([
            AccountSquareCredentialDomainObjectAbstract::ACCOUNT_ID => $accountId,
            AccountSquareCredentialDomainObjectAbstract::ENVIRONMENT => $environment,
        ]);

        if ($existing !== null) {
            return $this->credentialRepository->updateFromArray($existing->getId(), $attributes);
        }

        return $this->credentialRepository->create($attributes + [
                AccountSquareCredentialDomainObjectAbstract::ACCOUNT_ID => $accountId,
                AccountSquareCredentialDomainObjectAbstract::ENVIRONMENT => $environment,
            ]);
    }
}
