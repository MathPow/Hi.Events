<?php

namespace HiEvents\Services\Application\Handlers\EventChange\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class CancelEventDTO extends BaseDataObject
{
    public function __construct(
        public readonly int    $eventId,
        public readonly int    $accountId,
        public readonly ?int   $userId,
        public readonly string $message,
        public readonly bool   $refundOrders,
    )
    {
    }
}
