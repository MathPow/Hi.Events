<?php

namespace HiEvents\Services\Application\Handlers\Order\Deposit;

use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Services\Application\Handlers\Order\Deposit\DTO\SplitDepositRetentionDTO;
use HiEvents\Services\Domain\Order\OrderDepositService;
use Illuminate\Support\Collection;

class SplitDepositRetentionHandler
{
    public function __construct(
        private readonly OrderDepositService $orderDepositService,
    )
    {
    }

    /**
     * @return Collection<OrderDomainObject>
     * @throws ResourceConflictException
     */
    public function handle(SplitDepositRetentionDTO $dto): Collection
    {
        return $this->orderDepositService->splitRetention(
            eventId: $dto->eventId,
            amount: $dto->amount,
            note: $dto->note,
            orderIds: $dto->orderIds,
            notify: $dto->notify,
        );
    }
}
