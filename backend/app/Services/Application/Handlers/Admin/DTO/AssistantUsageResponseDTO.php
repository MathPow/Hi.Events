<?php

namespace HiEvents\Services\Application\Handlers\Admin\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class AssistantUsageResponseDTO extends BaseDataObject
{
    public function __construct(
        public readonly ?int   $days,
        public readonly string $since,
        public readonly string $model,
        public readonly string $default_model,
        public readonly array  $models,
        public readonly int    $daily_limit,
        public readonly array  $totals,
        public readonly array  $daily,
        public readonly array  $accounts,
        public readonly array  $users,
    )
    {
    }
}
