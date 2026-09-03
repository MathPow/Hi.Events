<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Admin\RegistrationInvite\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class CreateRegistrationInviteDTO extends BaseDataObject
{
    public function __construct(
        public readonly int     $createdByUserId,
        public readonly ?string $email = null,
        public readonly ?string $label = null,
        public readonly ?int    $expiresInDays = null,
    )
    {
    }
}
