<?php

namespace HiEvents\Services\Application\Handlers\Order\Deposit\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\Status\OrderDepositStatus;

class UpdateOrderDepositDTO extends BaseDataObject
{
    public function __construct(
        public readonly int                $eventId,
        public readonly int                $orderId,
        public readonly OrderDepositStatus $status,
        public readonly ?float             $retainedAmount = null,
        public readonly ?string            $note = null,
        public readonly bool               $notify = false,
    )
    {
    }
}
