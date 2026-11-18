<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\Models\EventChangeRefund;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;

/**
 * @extends BaseRepository<EventChangeRefundDomainObject>
 */
class EventChangeRefundRepository extends BaseRepository implements EventChangeRefundRepositoryInterface
{
    protected function getModel(): string
    {
        return EventChangeRefund::class;
    }

    public function getDomainObject(): string
    {
        return EventChangeRefundDomainObject::class;
    }
}
