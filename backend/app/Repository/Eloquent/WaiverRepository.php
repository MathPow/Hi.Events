<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\WaiverDomainObject;
use HiEvents\Models\Waiver;
use HiEvents\Repository\Interfaces\WaiverRepositoryInterface;

/**
 * @extends BaseRepository<WaiverDomainObject>
 */
class WaiverRepository extends BaseRepository implements WaiverRepositoryInterface
{
    protected function getModel(): string
    {
        return Waiver::class;
    }

    public function getDomainObject(): string
    {
        return WaiverDomainObject::class;
    }
}
