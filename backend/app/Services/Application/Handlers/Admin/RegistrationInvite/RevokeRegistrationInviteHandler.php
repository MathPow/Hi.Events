<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Admin\RegistrationInvite;

use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\AccountRegistrationInviteRepositoryInterface;
use HiEvents\Services\Domain\Account\AccountRegistrationInviteService;

class RevokeRegistrationInviteHandler
{
    public function __construct(
        private readonly AccountRegistrationInviteService             $registrationInviteService,
        private readonly AccountRegistrationInviteRepositoryInterface $inviteRepository,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function handle(int $inviteId): void
    {
        $invite = $this->inviteRepository->findFirstWhere(['id' => $inviteId]);

        if ($invite === null) {
            throw new ResourceNotFoundException(__('Invitation not found'));
        }

        $this->registrationInviteService->revoke($invite->getId());
    }
}
