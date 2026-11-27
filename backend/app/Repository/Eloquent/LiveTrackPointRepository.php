<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\LiveTrackPointDomainObject;
use HiEvents\Models\LiveTrackPoint;
use HiEvents\Repository\Interfaces\LiveTrackPointRepositoryInterface;

/**
 * @extends BaseRepository<LiveTrackPointDomainObject>
 */
class LiveTrackPointRepository extends BaseRepository implements LiveTrackPointRepositoryInterface
{
    protected function getModel(): string
    {
        return LiveTrackPoint::class;
    }

    public function getDomainObject(): string
    {
        return LiveTrackPointDomainObject::class;
    }

    public function insertIgnoringDuplicates(array $points): int
    {
        if ($points === []) {
            return 0;
        }

        $inserted = LiveTrackPoint::query()->insertOrIgnore($points);
        $this->resetModel();

        return $inserted;
    }
}
