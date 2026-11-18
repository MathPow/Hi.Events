<?php

namespace HiEvents\Services\Application\Handlers\EventChange\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

/**
 * Dates as typed in the event's timezone (« 2026-11-21 09:00 »).
 */
class PostponeEventDTO extends BaseDataObject
{
    public function __construct(
        public readonly int     $eventId,
        public readonly int     $accountId,
        public readonly ?int    $userId,
        public readonly string  $startDate,
        public readonly ?string $endDate,
        public readonly string  $message,
        public readonly bool    $refundsAllowed,
        public readonly ?string $refundDeadline,
    )
    {
    }
}
