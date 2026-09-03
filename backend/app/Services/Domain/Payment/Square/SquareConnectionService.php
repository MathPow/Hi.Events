<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Payment\Square;

use HiEvents\DomainObjects\AccountSquareCredentialDomainObject;
use HiEvents\DomainObjects\Generated\AccountSquareCredentialDomainObjectAbstract;
use HiEvents\Exceptions\Square\SquareApiException;
use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Repository\Interfaces\AccountSquareCredentialRepositoryInterface;
use HiEvents\Services\Domain\Payment\Square\DTO\SquareConnectionDTO;
use HiEvents\Services\Domain\Payment\Square\DTO\SquareLocationDTO;
use HiEvents\Services\Infrastructure\Square\SquareClientFactory;
use HiEvents\Services\Infrastructure\Square\SquareConfigurationService;
use Illuminate\Support\Carbon;
use Psr\Log\LoggerInterface;

/**
 * Etat de la connexion Square d'un compte: autorisation, choix du point de vente,
 * deconnexion.
 *
 * Un jeton seul ne suffit pas a encaisser: l'API Payments exige un location_id,
 * et un marchand peut en avoir plusieurs. Tant qu'il n'a pas tranche, la
 * connexion existe mais n'est pas utilisable, d'ou setup_completed_at pose
 * seulement au moment du choix.
 */
class SquareConnectionService
{
    public function __construct(
        private readonly SquareOAuthService                         $oAuthService,
        private readonly SquareClientFactory                        $clientFactory,
        private readonly SquareConfigurationService                 $configurationService,
        private readonly AccountSquareCredentialRepositoryInterface $credentialRepository,
        private readonly LoggerInterface                            $logger,
    )
    {
    }

    public function findCredential(int $accountId): ?AccountSquareCredentialDomainObject
    {
        return $this->credentialRepository->findFirstWhere([
            AccountSquareCredentialDomainObjectAbstract::ACCOUNT_ID => $accountId,
            AccountSquareCredentialDomainObjectAbstract::ENVIRONMENT => $this->configurationService
                ->getEnvironment()->value,
        ]);
    }

    /**
     * @throws SquareOAuthException
     */
    public function getConnection(int $accountId): SquareConnectionDTO
    {
        $credential = $this->findCredential($accountId);

        if ($credential === null) {
            return new SquareConnectionDTO(
                credential: null,
                locations: [],
                isOAuthConfigured: $this->configurationService->isOAuthConfigured(),
            );
        }

        return new SquareConnectionDTO(
            credential: $credential,
            locations: $this->listLocations($credential),
            isOAuthConfigured: $this->configurationService->isOAuthConfigured(),
        );
    }

    /**
     * @throws SquareOAuthException
     */
    public function connect(int $accountId, string $code): SquareConnectionDTO
    {
        $credential = $this->oAuthService->exchangeCodeForTokens($accountId, $code);
        $credential = $this->storeMerchantDetails($credential);

        $locations = $this->listLocations($credential);

        // Le cas courant est un marchand avec un seul point de vente: lui
        // demander de le choisir serait une etape pour rien.
        $selectable = array_values(array_filter($locations, fn(SquareLocationDTO $l) => $l->isActive));

        if (count($selectable) === 1) {
            $credential = $this->selectLocation($credential, $selectable[0]->id);
        }

        return new SquareConnectionDTO(
            credential: $credential,
            locations: $locations,
            isOAuthConfigured: true,
        );
    }

    /**
     * @return SquareLocationDTO[]
     * @throws SquareOAuthException
     */
    public function listLocations(AccountSquareCredentialDomainObject $credential): array
    {
        $credential = $this->oAuthService->ensureFreshTokens($credential);

        try {
            $response = $this->clientFactory->createForCredential($credential)->listLocations();
        } catch (SquareApiException $exception) {
            // Un point de vente illisible ne doit pas casser l'affichage de la
            // page de reglages: on montre la connexion sans la liste.
            $this->logger->warning('Could not list Square locations: ' . $exception->getMessage(), [
                'account_id' => $credential->getAccountId(),
            ]);

            return [];
        }

        return array_map(
            static fn(array $location) => new SquareLocationDTO(
                id: $location['id'],
                name: $location['name'] ?? $location['id'],
                currency: $location['currency'] ?? null,
                country: $location['country'] ?? null,
                isActive: ($location['status'] ?? 'ACTIVE') === 'ACTIVE',
            ),
            $response['locations'] ?? [],
        );
    }

    /**
     * @throws SquareNotConnectedException|SquareOAuthException
     */
    public function selectLocation(
        AccountSquareCredentialDomainObject $credential,
        string                              $locationId,
    ): AccountSquareCredentialDomainObject
    {
        $location = null;

        foreach ($this->listLocations($credential) as $candidate) {
            if ($candidate->id === $locationId) {
                $location = $candidate;
                break;
            }
        }

        // Sans cette verification, un location_id arbitraire serait accepte et
        // chaque paiement echouerait ensuite chez Square, sans explication.
        if ($location === null) {
            throw new SquareNotConnectedException(
                __('That location does not belong to the connected Square merchant.')
            );
        }

        return $this->credentialRepository->updateFromArray($credential->getId(), [
            AccountSquareCredentialDomainObjectAbstract::LOCATION_ID => $location->id,
            AccountSquareCredentialDomainObjectAbstract::CURRENCY => $location->currency,
            AccountSquareCredentialDomainObjectAbstract::COUNTRY => $location->country,
            AccountSquareCredentialDomainObjectAbstract::SETUP_COMPLETED_AT => Carbon::now()->toDateTimeString(),
        ]);
    }

    public function disconnect(AccountSquareCredentialDomainObject $credential): void
    {
        $this->oAuthService->revoke($credential);
    }

    private function storeMerchantDetails(
        AccountSquareCredentialDomainObject $credential
    ): AccountSquareCredentialDomainObject
    {
        if ($credential->getMerchantId() === null) {
            return $credential;
        }

        try {
            $merchant = $this->clientFactory->createForCredential($credential)
                ->retrieveMerchant($credential->getMerchantId());
        } catch (SquareApiException $exception) {
            $this->logger->warning('Could not read Square merchant details: ' . $exception->getMessage(), [
                'account_id' => $credential->getAccountId(),
            ]);

            return $credential;
        }

        return $this->credentialRepository->updateFromArray($credential->getId(), [
            AccountSquareCredentialDomainObjectAbstract::MERCHANT_DETAILS => $merchant['merchant'] ?? null,
        ]);
    }
}
