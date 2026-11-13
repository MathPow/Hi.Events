<?php

namespace HiEvents\Http\Actions\Events;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\RecurringEventValidationException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Event\RepeatEventRequest;
use HiEvents\Resources\Event\EventResource;
use HiEvents\Services\Application\Handlers\Event\DTO\RepeatEventDTO;
use HiEvents\Services\Application\Handlers\Event\RepeatEventHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class RepeatEventAction extends BaseAction
{
    public function __construct(private readonly RepeatEventHandler $handler)
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(int $eventId, RepeatEventRequest $request): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        try {
            $result = $this->handler->handle(new RepeatEventDTO(
                eventId: $eventId,
                accountId: $this->getAuthenticatedAccountId(),
                dates: $request->validated('dates'),
            ));
        } catch (RecurringEventValidationException $exception) {
            throw ValidationException::withMessages(['dates' => $exception->getMessage()]);
        } catch (ResourceNotFoundException $exception) {
            return $this->errorResponse($exception->getMessage(), Response::HTTP_NOT_FOUND);
        }

        if ($result->createdEvents->isEmpty()) {
            return $this->errorResponse(
                __('The dates could not be created. Please try again.'),
                Response::HTTP_INTERNAL_SERVER_ERROR,
            );
        }

        return $this->resourceResponse(
            resource: EventResource::class,
            data: $result->createdEvents,
            statusCode: Response::HTTP_CREATED,
            meta: ['failed_date' => $result->failedDate],
        );
    }
}
