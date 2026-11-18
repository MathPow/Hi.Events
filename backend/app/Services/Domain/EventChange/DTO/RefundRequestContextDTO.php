<?php

namespace HiEvents\Services\Domain\EventChange\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;

class RefundRequestContextDTO extends BaseDataObject
{
    public function __construct(
        public readonly EventDomainObject              $event,
        public readonly EventDateChangeDomainObject    $dateChange,
        public readonly OrderDomainObject              $order,
        public readonly ?EventChangeRefundDomainObject $refund,
    )
    {
    }
}
