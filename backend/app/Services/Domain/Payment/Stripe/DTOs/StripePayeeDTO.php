<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Payment\Stripe\DTOs;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\Enums\StripePlatform;

/**
 * Qui encaisse une commande, et avec quelles cles.
 *
 * La plateforme accompagne l'identifiant: un compte connecte cree par une
 * plateforme ne peut pas etre debite avec les cles d'une autre.
 */
class StripePayeeDTO extends BaseDataObject
{
    public function __construct(
        public readonly ?string         $stripeAccountId,
        public readonly ?StripePlatform $platform,
        public readonly bool            $isOrganizerAccount,
    )
    {
    }
}
