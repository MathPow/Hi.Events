<?php

namespace HiEvents\Http\Actions\Users;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\User\UpdateUserNotificationEmailsRequest;
use HiEvents\Resources\User\UserResource;
use HiEvents\Services\Application\Handlers\User\DTO\UpdateUserNotificationEmailsDTO;
use HiEvents\Services\Application\Handlers\User\UpdateUserNotificationEmailsHandler;
use Illuminate\Http\JsonResponse;

class UpdateUserNotificationEmailsAction extends BaseAction
{
    public function __construct(
        private readonly UpdateUserNotificationEmailsHandler $handler,
    )
    {
    }

    public function __invoke(UpdateUserNotificationEmailsRequest $request, int $userId): JsonResponse
    {
        $this->isActionAuthorized(
            entityId: $userId,
            entityType: UserDomainObject::class,
            minimumRole: Role::ADMIN
        );

        $user = $this->handler->handle(new UpdateUserNotificationEmailsDTO(
            user_id: $userId,
            account_id: $this->getAuthenticatedAccountId(),
            organizer_messages: $request->has('organizer_messages') ? $request->boolean('organizer_messages') : null,
            new_orders: $request->has('new_orders') ? $request->boolean('new_orders') : null,
        ));

        return $this->resourceResponse(UserResource::class, $user);
    }
}
