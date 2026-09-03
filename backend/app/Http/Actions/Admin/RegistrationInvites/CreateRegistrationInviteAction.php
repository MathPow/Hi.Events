<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Admin\RegistrationInvites;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Admin\CreateRegistrationInviteRequest;
use HiEvents\Http\ResponseCodes;
use HiEvents\Resources\Account\AccountRegistrationInviteResource;
use HiEvents\Services\Application\Handlers\Admin\RegistrationInvite\CreateRegistrationInviteHandler;
use HiEvents\Services\Application\Handlers\Admin\RegistrationInvite\DTO\CreateRegistrationInviteDTO;
use Illuminate\Http\JsonResponse;

class CreateRegistrationInviteAction extends BaseAction
{
    public function __construct(
        private readonly CreateRegistrationInviteHandler $handler,
    )
    {
    }

    public function __invoke(CreateRegistrationInviteRequest $request): JsonResponse
    {
        $this->minimumAllowedRole(Role::SUPERADMIN);

        $created = $this->handler->handle(new CreateRegistrationInviteDTO(
            createdByUserId: $this->getAuthenticatedUser()->getId(),
            email: $request->validated('email'),
            label: $request->validated('label'),
            expiresInDays: $request->validated('expires_in_days') === null
                ? null
                : (int)$request->validated('expires_in_days'),
        ));

        return $this->jsonResponse(
            data: array_merge(
                (new AccountRegistrationInviteResource($created->invite))->toArray($request),
                // Seule reponse ou le lien complet apparait: il n'est pas
                // reconstituable ensuite depuis la base.
                ['registration_url' => $created->registrationUrl],
            ),
            statusCode: ResponseCodes::HTTP_CREATED,
            wrapInData: true,
        );
    }
}
