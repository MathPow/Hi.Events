<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\OrganizerMessageReplyDomainObject;
use HiEvents\Models\OrganizerMessageReply;
use HiEvents\Repository\Interfaces\OrganizerMessageReplyRepositoryInterface;

/**
 * @extends BaseRepository<OrganizerMessageReplyDomainObject>
 */
class OrganizerMessageReplyRepository extends BaseRepository implements OrganizerMessageReplyRepositoryInterface
{
    protected function getModel(): string
    {
        return OrganizerMessageReply::class;
    }

    public function getDomainObject(): string
    {
        return OrganizerMessageReplyDomainObject::class;
    }
}
