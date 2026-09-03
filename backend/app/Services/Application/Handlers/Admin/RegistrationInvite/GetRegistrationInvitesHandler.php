<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Admin\RegistrationInvite;

use HiEvents\DomainObjects\Generated\AccountRegistrationInviteDomainObjectAbstract;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Interfaces\AccountRegistrationInviteRepositoryInterface;
use Illuminate\Support\Collection;

class GetRegistrationInvitesHandler
{
    public function __construct(
        private readonly AccountRegistrationInviteRepositoryInterface $inviteRepository,
    )
    {
    }

    public function handle(): Collection
    {
        return $this->inviteRepository->findWhere(
            where: [],
            orderAndDirections: [
                new OrderAndDirection(
                    order: AccountRegistrationInviteDomainObjectAbstract::CREATED_AT,
                    direction: OrderAndDirection::DIRECTION_DESC,
                ),
            ],
        );
    }
}
