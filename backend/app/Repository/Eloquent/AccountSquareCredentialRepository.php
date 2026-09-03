<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\AccountSquareCredentialDomainObject;
use HiEvents\Models\AccountSquareCredential;
use HiEvents\Repository\Interfaces\AccountSquareCredentialRepositoryInterface;

/**
 * @extends BaseRepository<AccountSquareCredentialDomainObject>
 */
class AccountSquareCredentialRepository extends BaseRepository implements AccountSquareCredentialRepositoryInterface
{
    protected function getModel(): string
    {
        return AccountSquareCredential::class;
    }

    public function getDomainObject(): string
    {
        return AccountSquareCredentialDomainObject::class;
    }
}
