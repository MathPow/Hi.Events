<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\OrganizerStripePlatformDomainObject;
use HiEvents\Models\OrganizerStripePlatform;
use HiEvents\Repository\Interfaces\OrganizerStripePlatformRepositoryInterface;

/**
 * @extends BaseRepository<OrganizerStripePlatformDomainObject>
 */
class OrganizerStripePlatformRepository extends BaseRepository implements OrganizerStripePlatformRepositoryInterface
{
    protected function getModel(): string
    {
        return OrganizerStripePlatform::class;
    }

    public function getDomainObject(): string
    {
        return OrganizerStripePlatformDomainObject::class;
    }
}
