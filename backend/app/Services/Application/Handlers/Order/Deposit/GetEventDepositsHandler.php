<?php

namespace HiEvents\Services\Application\Handlers\Order\Deposit;

use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\Services\Domain\Order\OrderDepositService;
use Illuminate\Support\Collection;

class GetEventDepositsHandler
{
    public function __construct(
        private readonly OrderDepositService $orderDepositService,
    )
    {
    }

    /**
     * @return Collection<OrderDomainObject>
     */
    public function handle(int $eventId): Collection
    {
        return $this->orderDepositService->getDepositOrders($eventId);
    }
}
