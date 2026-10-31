<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\PushSubscriptionDomainObject;
use HiEvents\Models\PushSubscription;
use HiEvents\Repository\Interfaces\PushSubscriptionRepositoryInterface;

/**
 * @extends BaseRepository<PushSubscriptionDomainObject>
 */
class PushSubscriptionRepository extends BaseRepository implements PushSubscriptionRepositoryInterface
{
    protected function getModel(): string
    {
        return PushSubscription::class;
    }

    public function getDomainObject(): string
    {
        return PushSubscriptionDomainObject::class;
    }
}
