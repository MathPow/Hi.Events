<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Models\EventRouteFile;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;

/**
 * @extends BaseRepository<EventRouteFileDomainObject>
 */
class EventRouteFileRepository extends BaseRepository implements EventRouteFileRepositoryInterface
{
    protected function getModel(): string
    {
        return EventRouteFile::class;
    }

    public function getDomainObject(): string
    {
        return EventRouteFileDomainObject::class;
    }
}
