<?php

namespace HiEvents\Services\Application\Handlers\Order\Deposit;

use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Services\Application\Handlers\Order\Deposit\DTO\UpdateOrderDepositDTO;
use HiEvents\Services\Domain\Order\OrderDepositService;

class UpdateOrderDepositHandler
{
    public function __construct(
        private readonly OrderDepositService $orderDepositService,
    )
    {
    }

    /**
     * @throws ResourceConflictException
     */
    public function handle(UpdateOrderDepositDTO $dto): OrderDomainObject
    {
        return $this->orderDepositService->update(
            eventId: $dto->eventId,
            orderId: $dto->orderId,
            status: $dto->status,
            retainedAmount: $dto->retainedAmount,
            note: $dto->note,
            notify: $dto->notify,
        );
    }
}
