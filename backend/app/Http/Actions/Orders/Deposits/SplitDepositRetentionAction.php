<?php

namespace HiEvents\Http\Actions\Orders\Deposits;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Order\Deposit\SplitDepositRetentionRequest;
use HiEvents\Resources\Order\OrderResource;
use HiEvents\Services\Application\Handlers\Order\Deposit\DTO\SplitDepositRetentionDTO;
use HiEvents\Services\Application\Handlers\Order\Deposit\SplitDepositRetentionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class SplitDepositRetentionAction extends BaseAction
{
    public function __construct(
        private readonly SplitDepositRetentionHandler $handler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(SplitDepositRetentionRequest $request, int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        try {
            $orders = $this->handler->handle(new SplitDepositRetentionDTO(
                eventId: $eventId,
                amount: (float)$request->validated('amount'),
                note: $request->validated('note'),
                orderIds: array_map('intval', $request->validated('order_ids')),
                notify: (bool)$request->validated('notify', false),
            ));
        } catch (ResourceConflictException $e) {
            throw ValidationException::withMessages(['amount' => $e->getMessage()]);
        }

        return $this->resourceResponse(
            resource: OrderResource::class,
            data: $orders,
        );
    }
}
