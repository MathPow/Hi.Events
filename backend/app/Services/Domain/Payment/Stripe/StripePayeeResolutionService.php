<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Payment\Stripe;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\Generated\OrganizerStripePlatformDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerStripePlatformDomainObject;
use HiEvents\Repository\Interfaces\OrganizerStripePlatformRepositoryInterface;
use HiEvents\Services\Domain\Payment\Stripe\DTOs\StripePayeeDTO;

/**
 * Determine sur quel compte Stripe une commande est encaissee.
 *
 * Un organisateur qui a branche son propre Stripe recoit son argent
 * directement. Sinon on retombe sur le compte de la billetterie: mieux vaut
 * encaisser sur le mauvais compte et reverser ensuite que refuser la vente.
 */
class StripePayeeResolutionService
{
    public function __construct(
        private readonly OrganizerStripePlatformRepositoryInterface $organizerStripePlatformRepository,
    )
    {
    }

    public function resolveForOrganizer(?int $organizerId, AccountDomainObject $account): StripePayeeDTO
    {
        $organizerPlatform = $organizerId === null
            ? null
            : $this->findUsablePlatform($organizerId);

        if ($organizerPlatform !== null) {
            return new StripePayeeDTO(
                stripeAccountId: $organizerPlatform->getStripeAccountId(),
                platform: $organizerPlatform->getStripePlatformEnum(),
                isOrganizerAccount: true,
            );
        }

        return new StripePayeeDTO(
            stripeAccountId: $account->getActiveStripeAccountId(),
            platform: $account->getActiveStripePlatform(),
            isOrganizerAccount: false,
        );
    }

    public function findPlatform(int $organizerId): ?OrganizerStripePlatformDomainObject
    {
        return $this->organizerStripePlatformRepository->findFirstWhere([
            OrganizerStripePlatformDomainObjectAbstract::ORGANIZER_ID => $organizerId,
        ]);
    }

    /**
     * Un compte connecte dont l'onboarding n'est pas termine ne peut pas
     * encaisser: on l'ignore plutot que d'envoyer l'acheteur vers un echec.
     */
    private function findUsablePlatform(int $organizerId): ?OrganizerStripePlatformDomainObject
    {
        $platform = $this->findPlatform($organizerId);

        return $platform?->isSetupComplete() === true ? $platform : null;
    }
}
