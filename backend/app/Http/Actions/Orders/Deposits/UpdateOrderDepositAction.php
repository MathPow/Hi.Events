<?php

namespace HiEvents\Http\Actions\Orders\Deposits;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Status\OrderDepositStatus;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Order\Deposit\UpdateOrderDepositRequest;
use HiEvents\Resources\Order\OrderResource;
use HiEvents\Services\Application\Handlers\Order\Deposit\DTO\UpdateOrderDepositDTO;
use HiEvents\Services\Application\Handlers\Order\Deposit\UpdateOrderDepositHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class UpdateOrderDepositAction extends BaseAction
{
    public function __construct(
        private readonly UpdateOrderDepositHandler $handler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(UpdateOrderDepositRequest $request, int $eventId, int $orderId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        try {
            $order = $this->handler->handle(new UpdateOrderDepositDTO(
                eventId: $eventId,
                orderId: $orderId,
                status: OrderDepositStatus::fromName($request->validated('status')),
                retainedAmount: $request->validated('retained_amount') !== null ? (float)$request->validated('retained_amount') : null,
                note: $request->validated('note'),
                notify: (bool)$request->validated('notify', false),
            ));
        } catch (ResourceConflictException $e) {
            throw ValidationException::withMessages(['retained_amount' => $e->getMessage()]);
        }

        return $this->resourceResponse(
            resource: OrderResource::class,
            data: $order,
        );
    }
}
