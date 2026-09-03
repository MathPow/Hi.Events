<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Account\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\AccountRegistrationInviteDomainObject;

class CreatedRegistrationInviteDTO extends BaseDataObject
{
    public function __construct(
        public readonly AccountRegistrationInviteDomainObject $invite,

        /**
         * Contient le jeton en clair, et c'est la seule occasion de le lire: la
         * base n'en garde que le hash, un lien perdu se remplace plutot qu'il ne
         * se retrouve.
         */
        public readonly string $registrationUrl,
    )
    {
    }
}
