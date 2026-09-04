<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Organizers\Stripe;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\CreateStripeConnectAccountFailedException;
use HiEvents\Exceptions\CreateStripeConnectAccountLinksFailedException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Resources\Organizer\Stripe\OrganizerStripeConnectionResource;
use HiEvents\Services\Application\Handlers\Organizer\Stripe\ConnectOrganizerStripeHandler;
use Illuminate\Http\JsonResponse;

class ConnectOrganizerStripeAction extends BaseAction
{
    public function __construct(
        private readonly ConnectOrganizerStripeHandler $handler,
    )
    {
    }

    public function __invoke(int $organizerId): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class, Role::ADMIN);

        try {
            $connection = $this->handler->handle($organizerId, $this->getAuthenticatedAccountId());
        } catch (ResourceNotFoundException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: ResponseCodes::HTTP_NOT_FOUND,
            );
        } catch (CreateStripeConnectAccountFailedException|CreateStripeConnectAccountLinksFailedException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: ResponseCodes::HTTP_INTERNAL_SERVER_ERROR,
            );
        }

        return $this->jsonResponse(
            data: new OrganizerStripeConnectionResource($connection),
            wrapInData: true,
        );
    }
}
