<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\LiveTrackDomainObject;
use HiEvents\Models\LiveTrack;
use HiEvents\Repository\Interfaces\LiveTrackRepositoryInterface;

/**
 * @extends BaseRepository<LiveTrackDomainObject>
 */
class LiveTrackRepository extends BaseRepository implements LiveTrackRepositoryInterface
{
    protected function getModel(): string
    {
        return LiveTrack::class;
    }

    public function getDomainObject(): string
    {
        return LiveTrackDomainObject::class;
    }
}
