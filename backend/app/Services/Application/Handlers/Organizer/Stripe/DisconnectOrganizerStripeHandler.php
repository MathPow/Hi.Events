<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Organizer\Stripe;

use HiEvents\Services\Domain\Payment\Stripe\OrganizerStripeConnectService;

class DisconnectOrganizerStripeHandler
{
    public function __construct(
        private readonly OrganizerStripeConnectService $connectService,
    )
    {
    }

    public function handle(int $organizerId): void
    {
        $this->connectService->disconnect($organizerId);
    }
}
