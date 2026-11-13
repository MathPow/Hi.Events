<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\Models\EventDateChange;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;

/**
 * @extends BaseRepository<EventDateChangeDomainObject>
 */
class EventDateChangeRepository extends BaseRepository implements EventDateChangeRepositoryInterface
{
    protected function getModel(): string
    {
        return EventDateChange::class;
    }

    public function getDomainObject(): string
    {
        return EventDateChangeDomainObject::class;
    }
}
