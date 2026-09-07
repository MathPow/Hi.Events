<?php

namespace HiEvents\Services\Application\Handlers\Admin\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class GetPlatformRevenueDTO extends BaseDataObject
{
    public function __construct(
        public readonly int $days = 30,
        public readonly int $months = 12,
        public readonly int $topContributors = 10,
    )
    {
    }
}
