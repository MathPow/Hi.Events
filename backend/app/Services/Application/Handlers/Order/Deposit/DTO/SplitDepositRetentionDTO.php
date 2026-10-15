<?php

namespace HiEvents\Services\Application\Handlers\Order\Deposit\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class SplitDepositRetentionDTO extends BaseDataObject
{
    /**
     * @param int[] $orderIds
     */
    public function __construct(
        public readonly int    $eventId,
        public readonly float  $amount,
        public readonly string $note,
        public readonly array  $orderIds,
        public readonly bool   $notify = false,
    )
    {
    }
}
