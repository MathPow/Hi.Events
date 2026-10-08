<?php

declare(strict_types=1);

namespace HiEvents\Resources\Affiliate;

use HiEvents\Resources\BaseResource;
use HiEvents\Services\Application\Handlers\Affiliate\DTO\AffiliatePartnerPageResponseDTO;
use Illuminate\Http\Request;

/**
 * @mixin AffiliatePartnerPageResponseDTO
 */
class AffiliatePartnerPageResourcePublic extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'event_id' => $this->eventId,
            'name' => $this->name,
            'code' => $this->code,
            'status' => $this->status,
            'promo_code' => $this->promoCode,
            'currency' => $this->currency,
            'orders_count' => $this->ordersCount,
            'tickets_count' => $this->ticketsCount,
            'total_gross' => $this->totalGross,
        ];
    }
}
