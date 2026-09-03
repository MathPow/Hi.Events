<?php

namespace HiEvents\DomainObjects;

use Carbon\Carbon;
use HiEvents\DomainObjects\Enums\SquareEnvironment;

class AccountSquareCredentialDomainObject extends Generated\AccountSquareCredentialDomainObjectAbstract
{
    public function getEnvironmentEnum(): SquareEnvironment
    {
        return SquareEnvironment::tryFrom($this->getEnvironment() ?? '')
            ?? SquareEnvironment::PRODUCTION;
    }

    public function isSetupComplete(): bool
    {
        return $this->getSetupCompletedAt() !== null
            && $this->getAccessToken() !== null
            && $this->getLocationId() !== null;
    }

    /**
     * Les jetons OAuth Square expirent (30 jours). On rafraichit avec une marge
     * d'un jour: un jeton qui expire pendant un checkout ferait echouer le
     * paiement au pire moment, alors que le refresh est silencieux.
     */
    public function needsTokenRefresh(): bool
    {
        if ($this->getTokenExpiresAt() === null) {
            return false;
        }

        return (new Carbon($this->getTokenExpiresAt()))->subDay()->isPast();
    }
}
