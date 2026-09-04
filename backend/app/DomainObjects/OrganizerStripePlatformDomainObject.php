<?php

namespace HiEvents\DomainObjects;

use HiEvents\DomainObjects\Enums\StripePlatform;

class OrganizerStripePlatformDomainObject extends Generated\OrganizerStripePlatformDomainObjectAbstract
{
    /**
     * Un compte connecte cree mais dont l'onboarding Stripe n'est pas termine ne
     * peut pas encaisser: le considerer comme utilisable enverrait les acheteurs
     * vers un paiement voue a l'echec.
     */
    public function isSetupComplete(): bool
    {
        return $this->getStripeSetupCompletedAt() !== null
            && $this->getStripeAccountId() !== null;
    }

    public function getStripePlatformEnum(): ?StripePlatform
    {
        return $this->getStripeConnectPlatform() === null
            ? null
            : StripePlatform::fromString($this->getStripeConnectPlatform());
    }
}
