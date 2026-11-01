<?php

namespace HiEvents\Repository\Interfaces;

use HiEvents\DomainObjects\EventSettingDomainObject;
use Illuminate\Support\Collection;

/**
 * @extends RepositoryInterface<EventSettingDomainObject>
 */
interface EventSettingsRepositoryInterface extends RepositoryInterface
{
    /**
     * Settings of in-person events with a place, not looked up since the lookup became $fingerprintVersion.
     *
     * @return Collection<int, EventSettingDomainObject>
     */
    public function findNotLocatedWith(string $fingerprintVersion, int $limit): Collection;
}
