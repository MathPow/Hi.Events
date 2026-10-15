<?php

namespace HiEvents\Http\Actions\Orders\Deposits;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Order\OrderResource;
use HiEvents\Services\Application\Handlers\Order\Deposit\GetEventDepositsHandler;
use Illuminate\Http\JsonResponse;

class GetEventDepositsAction extends BaseAction
{
    public function __construct(
        private readonly GetEventDepositsHandler $handler,
    )
    {
    }

    public function __invoke(int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        return $this->resourceResponse(
            resource: OrderResource::class,
            data: $this->handler->handle($eventId),
        );
    }
}
