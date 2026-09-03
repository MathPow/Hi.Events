<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Admin\RegistrationInvite;

use HiEvents\Services\Application\Handlers\Admin\RegistrationInvite\DTO\CreateRegistrationInviteDTO;
use HiEvents\Services\Domain\Account\AccountRegistrationInviteService;
use HiEvents\Services\Domain\Account\DTO\CreatedRegistrationInviteDTO;

class CreateRegistrationInviteHandler
{
    public function __construct(
        private readonly AccountRegistrationInviteService $registrationInviteService,
    )
    {
    }

    public function handle(CreateRegistrationInviteDTO $data): CreatedRegistrationInviteDTO
    {
        return $this->registrationInviteService->create(
            email: $data->email,
            label: $data->label,
            expiresInDays: $data->expiresInDays,
            createdByUserId: $data->createdByUserId,
        );
    }
}
