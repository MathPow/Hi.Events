<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Admin\RegistrationInvites;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Admin\RegistrationInvite\RevokeRegistrationInviteHandler;
use Illuminate\Http\Response;

class RevokeRegistrationInviteAction extends BaseAction
{
    public function __construct(
        private readonly RevokeRegistrationInviteHandler $handler,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function __invoke(int $inviteId): Response
    {
        $this->minimumAllowedRole(Role::SUPERADMIN);

        $this->handler->handle($inviteId);

        return $this->deletedResponse();
    }
}
