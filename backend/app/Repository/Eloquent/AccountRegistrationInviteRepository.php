<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\AccountRegistrationInviteDomainObject;
use HiEvents\Models\AccountRegistrationInvite;
use HiEvents\Repository\Interfaces\AccountRegistrationInviteRepositoryInterface;

/**
 * @extends BaseRepository<AccountRegistrationInviteDomainObject>
 */
class AccountRegistrationInviteRepository extends BaseRepository implements AccountRegistrationInviteRepositoryInterface
{
    protected function getModel(): string
    {
        return AccountRegistrationInvite::class;
    }

    public function getDomainObject(): string
    {
        return AccountRegistrationInviteDomainObject::class;
    }
}
