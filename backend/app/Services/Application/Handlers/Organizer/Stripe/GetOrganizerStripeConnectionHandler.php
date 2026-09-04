<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Organizer\Stripe;

use HiEvents\Services\Domain\Payment\Stripe\DTOs\OrganizerStripeConnectionDTO;
use HiEvents\Services\Domain\Payment\Stripe\OrganizerStripeConnectService;

class GetOrganizerStripeConnectionHandler
{
    public function __construct(
        private readonly OrganizerStripeConnectService $connectService,
    )
    {
    }

    public function handle(int $organizerId, bool $refresh = false): OrganizerStripeConnectionDTO
    {
        return $refresh
            ? $this->connectService->refreshStatus($organizerId)
            : $this->connectService->getConnection($organizerId);
    }
}
