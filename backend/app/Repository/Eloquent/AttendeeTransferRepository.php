<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\AttendeeTransferDomainObject;
use HiEvents\Models\AttendeeTransfer;
use HiEvents\Repository\Interfaces\AttendeeTransferRepositoryInterface;

/**
 * @extends BaseRepository<AttendeeTransferDomainObject>
 */
class AttendeeTransferRepository extends BaseRepository implements AttendeeTransferRepositoryInterface
{
    protected function getModel(): string
    {
        return AttendeeTransfer::class;
    }

    public function getDomainObject(): string
    {
        return AttendeeTransferDomainObject::class;
    }
}
