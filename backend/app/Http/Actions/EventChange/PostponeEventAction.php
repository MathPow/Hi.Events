<?php

namespace HiEvents\Http\Actions\EventChange;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\EventChangeNotAllowedException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\EventChange\PostponeEventRequest;
use HiEvents\Services\Application\Handlers\EventChange\DTO\PostponeEventDTO;
use HiEvents\Services\Application\Handlers\EventChange\GetEventChangeStatusHandler;
use HiEvents\Services\Application\Handlers\EventChange\PostponeEventHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Throwable;

class PostponeEventAction extends BaseAction
{
    public function __construct(
        private readonly PostponeEventHandler        $handler,
        private readonly GetEventChangeStatusHandler $statusHandler,
    )
    {
    }

    /**
     * @throws ValidationException
     * @throws Throwable
     */
    public function __invoke(PostponeEventRequest $request, int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        try {
            $this->handler->handle(new PostponeEventDTO(
                eventId: $eventId,
                accountId: $this->getAuthenticatedAccountId(),
                userId: $this->getAuthenticatedUser()->getId(),
                startDate: $request->validated('start_date'),
                endDate: $request->validated('end_date'),
                message: $request->validated('message'),
                refundsAllowed: $request->boolean('refunds_allowed'),
                refundDeadline: $request->validated('refund_deadline'),
            ));
        } catch (EventChangeNotAllowedException $exception) {
            throw ValidationException::withMessages(['start_date' => $exception->getMessage()]);
        }

        return $this->jsonResponse($this->statusHandler->handle($eventId)->toArray(), wrapInData: true);
    }
}
