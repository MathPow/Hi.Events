<?php

namespace HiEvents\Services\Application\Handlers\Admin\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class PlatformRevenueResponseDTO extends BaseDataObject
{
    public function __construct(
        public readonly int    $days,
        public readonly float  $contributions_total,
        public readonly float  $commissions_total,
        public readonly float  $total,
        public readonly int    $contributions_orders,
        public readonly float  $recent_contributions_total,
        public readonly float  $recent_commissions_total,
        public readonly float  $recent_total,
        public readonly int    $recent_contributions_orders,
        public readonly array  $by_currency,
        public readonly array  $monthly,
        public readonly array  $top_contributors,
    )
    {
    }
}
