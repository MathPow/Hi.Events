<?php

namespace HiEvents\Http\Actions\Accounts;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Account\UpdateAccountEventTypesRequest;
use HiEvents\Resources\Account\AccountResource;
use HiEvents\Services\Application\Handlers\Account\DTO\UpdateAccountEventTypesDTO;
use HiEvents\Services\Application\Handlers\Account\UpdateAccountEventTypesHandler;
use Illuminate\Http\JsonResponse;

class UpdateAccountEventTypesAction extends BaseAction
{
    public function __construct(
        private readonly UpdateAccountEventTypesHandler $handler,
    )
    {
    }

    public function __invoke(UpdateAccountEventTypesRequest $request): JsonResponse
    {
        $this->minimumAllowedRole(Role::ADMIN);

        $account = $this->handler->handle(new UpdateAccountEventTypesDTO(
            accountId: $this->getAuthenticatedAccountId(),
            eventTypes: $request->validated('event_types'),
        ));

        return $this->resourceResponse(AccountResource::class, $account);
    }
}
