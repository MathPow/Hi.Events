<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Organizers\Stripe;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Organizer\Stripe\OrganizerStripeConnectionResource;
use HiEvents\Services\Application\Handlers\Organizer\Stripe\GetOrganizerStripeConnectionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GetOrganizerStripeConnectionAction extends BaseAction
{
    public function __construct(
        private readonly GetOrganizerStripeConnectionHandler $handler,
    )
    {
    }

    public function __invoke(Request $request, int $organizerId): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class, Role::ADMIN);

        return $this->jsonResponse(
            data: new OrganizerStripeConnectionResource(
                $this->handler->handle($organizerId, $request->boolean('refresh')),
            ),
            wrapInData: true,
        );
    }
}
