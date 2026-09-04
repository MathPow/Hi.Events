<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Payment\Stripe\DTOs;

use HiEvents\DataTransferObjects\BaseDataObject;

class OrganizerStripeConnectionDTO extends BaseDataObject
{
    public function __construct(
        public readonly ?string $stripeAccountId,
        public readonly bool    $isSetupComplete,

        /**
         * Lien d'onboarding Stripe, present seulement tant que la configuration
         * n'est pas terminee. Il est a usage unique et de courte duree.
         */
        public readonly ?string $connectUrl,
    )
    {
    }
}
