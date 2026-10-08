<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Affiliate\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class AffiliatePartnerPageResponseDTO extends BaseDataObject
{
    public function __construct(
        public readonly int     $eventId,
        public readonly string  $name,
        public readonly string  $code,
        public readonly string  $status,
        public readonly ?string $promoCode,
        public readonly string  $currency,
        public readonly int     $ordersCount,
        public readonly int     $ticketsCount,
        public readonly float   $totalGross,
    )
    {
    }
}
