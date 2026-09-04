<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Organizers\Stripe;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Organizer\Stripe\DisconnectOrganizerStripeHandler;
use Illuminate\Http\Response;

class DisconnectOrganizerStripeAction extends BaseAction
{
    public function __construct(
        private readonly DisconnectOrganizerStripeHandler $handler,
    )
    {
    }

    public function __invoke(int $organizerId): Response
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class, Role::ADMIN);

        $this->handler->handle($organizerId);

        return $this->deletedResponse();
    }
}
