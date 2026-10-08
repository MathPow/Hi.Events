<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Affiliate;

use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;

class AffiliatePromoCodeValidationService
{
    public function __construct(
        private readonly PromoCodeRepositoryInterface $promoCodeRepository,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function assertPromoCodeBelongsToEvent(?int $promoCodeId, int $eventId): void
    {
        if ($promoCodeId === null) {
            return;
        }

        $promoCode = $this->promoCodeRepository->findFirstWhere([
            'id' => $promoCodeId,
            'event_id' => $eventId,
        ]);

        if (!$promoCode) {
            throw new ResourceNotFoundException(__('Promo code not found for this event'));
        }
    }
}
