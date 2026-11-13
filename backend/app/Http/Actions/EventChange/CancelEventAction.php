<?php

namespace HiEvents\Http\Actions\EventChange;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\EventChangeNotAllowedException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\EventChange\CancelEventRequest;
use HiEvents\Services\Application\Handlers\EventChange\CancelEventHandler;
use HiEvents\Services\Application\Handlers\EventChange\DTO\CancelEventDTO;
use HiEvents\Services\Application\Handlers\EventChange\GetEventChangeStatusHandler;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class CancelEventAction extends BaseAction
{
    public function __construct(
        private readonly CancelEventHandler          $handler,
        private readonly GetEventChangeStatusHandler $statusHandler,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function __invoke(CancelEventRequest $request, int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        try {
            $this->handler->handle(new CancelEventDTO(
                eventId: $eventId,
                accountId: $this->getAuthenticatedAccountId(),
                userId: $this->getAuthenticatedUser()->getId(),
                message: $request->validated('message'),
                refundOrders: $request->boolean('refund_orders'),
            ));
        } catch (EventChangeNotAllowedException $exception) {
            return $this->errorResponse($exception->getMessage(), Response::HTTP_CONFLICT);
        }

        return $this->jsonResponse($this->statusHandler->handle($eventId)->toArray(), wrapInData: true);
    }
}
