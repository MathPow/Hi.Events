<?php

declare(strict_types=1);

namespace HiEvents\Repository\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class AffiliateSalesSummaryDTO extends BaseDataObject
{
    public function __construct(
        public readonly int   $ordersCount,
        public readonly int   $ticketsCount,
        public readonly float $totalGross,
    )
    {
    }
}
