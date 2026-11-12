<?php

namespace HiEvents\Http\Actions\Users;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\User\UpdateUserMessageEmailsRequest;
use HiEvents\Resources\User\UserResource;
use HiEvents\Services\Application\Handlers\User\DTO\UpdateUserMessageEmailsDTO;
use HiEvents\Services\Application\Handlers\User\UpdateUserMessageEmailsHandler;
use Illuminate\Http\JsonResponse;

class UpdateUserMessageEmailsAction extends BaseAction
{
    public function __construct(
        private readonly UpdateUserMessageEmailsHandler $handler,
    )
    {
    }

    public function __invoke(UpdateUserMessageEmailsRequest $request, int $userId): JsonResponse
    {
        $this->isActionAuthorized(
            entityId: $userId,
            entityType: UserDomainObject::class,
            minimumRole: Role::ADMIN
        );

        $user = $this->handler->handle(new UpdateUserMessageEmailsDTO(
            user_id: $userId,
            account_id: $this->getAuthenticatedAccountId(),
            enabled: $request->boolean('enabled'),
        ));

        return $this->resourceResponse(UserResource::class, $user);
    }
}
