<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Organizer\Stripe;

use HiEvents\Exceptions\CreateStripeConnectAccountFailedException;
use HiEvents\Exceptions\CreateStripeConnectAccountLinksFailedException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Domain\Payment\Stripe\DTOs\OrganizerStripeConnectionDTO;
use HiEvents\Services\Domain\Payment\Stripe\OrganizerStripeConnectService;

class ConnectOrganizerStripeHandler
{
    public function __construct(
        private readonly OrganizerStripeConnectService $connectService,
        private readonly OrganizerRepositoryInterface  $organizerRepository,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     * @throws CreateStripeConnectAccountFailedException
     * @throws CreateStripeConnectAccountLinksFailedException
     */
    public function handle(int $organizerId, int $accountId): OrganizerStripeConnectionDTO
    {
        $organizer = $this->organizerRepository->findFirstWhere([
            'id' => $organizerId,
            'account_id' => $accountId,
        ]);

        if ($organizer === null) {
            throw new ResourceNotFoundException(__('Organizer not found'));
        }

        return $this->connectService->connect($organizer);
    }
}
