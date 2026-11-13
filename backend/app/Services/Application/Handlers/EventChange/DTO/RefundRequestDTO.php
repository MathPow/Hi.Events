<?php

namespace HiEvents\Services\Application\Handlers\EventChange\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class RefundRequestDTO extends BaseDataObject
{
    public function __construct(
        public readonly int     $eventId,
        public readonly string  $orderShortId,
        public readonly int     $dateChangeId,
        public readonly ?string $token,
    )
    {
    }
}
