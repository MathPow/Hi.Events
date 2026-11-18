<?php

namespace HiEvents\Services\Domain\EventChange\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;

class EventOrderRefundOutcomeDTO extends BaseDataObject
{
    public function __construct(
        public readonly EventChangeRefundStatus $status,
        public readonly float                   $amount = 0.0,
        public readonly ?string                 $error = null,
    )
    {
    }
}
