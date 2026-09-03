<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Admin\RegistrationInvites;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Account\AccountRegistrationInviteResource;
use HiEvents\Services\Application\Handlers\Admin\RegistrationInvite\GetRegistrationInvitesHandler;
use Illuminate\Http\JsonResponse;

class GetAllRegistrationInvitesAction extends BaseAction
{
    public function __construct(
        private readonly GetRegistrationInvitesHandler $handler,
    )
    {
    }

    public function __invoke(): JsonResponse
    {
        $this->minimumAllowedRole(Role::SUPERADMIN);

        return $this->resourceResponse(
            resource: AccountRegistrationInviteResource::class,
            data: $this->handler->handle(),
        );
    }
}
