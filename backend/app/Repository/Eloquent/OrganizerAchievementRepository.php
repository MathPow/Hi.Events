<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\OrganizerAchievementDomainObject;
use HiEvents\Models\OrganizerAchievement;
use HiEvents\Repository\Interfaces\OrganizerAchievementRepositoryInterface;

/**
 * @extends BaseRepository<OrganizerAchievementDomainObject>
 */
class OrganizerAchievementRepository extends BaseRepository implements OrganizerAchievementRepositoryInterface
{
    protected function getModel(): string
    {
        return OrganizerAchievement::class;
    }

    public function getDomainObject(): string
    {
        return OrganizerAchievementDomainObject::class;
    }
}
