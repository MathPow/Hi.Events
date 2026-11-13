<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\Models\EventCancellation;
use HiEvents\Repository\Interfaces\EventCancellationRepositoryInterface;

/**
 * @extends BaseRepository<EventCancellationDomainObject>
 */
class EventCancellationRepository extends BaseRepository implements EventCancellationRepositoryInterface
{
    protected function getModel(): string
    {
        return EventCancellation::class;
    }

    public function getDomainObject(): string
    {
        return EventCancellationDomainObject::class;
    }
}
