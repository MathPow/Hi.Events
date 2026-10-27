<?php

namespace HiEvents\Http\Actions\Questions;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\NoTicketProductsException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Question\QuestionResource;
use HiEvents\Services\Application\Handlers\Question\AddParticipantFormHandler;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AddParticipantFormAction extends BaseAction
{
    public function __construct(
        private readonly AddParticipantFormHandler $addParticipantFormHandler,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function __invoke(int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        try {
            $questions = $this->addParticipantFormHandler->handle($eventId);
        } catch (NoTicketProductsException $exception) {
            return $this->errorResponse(
                message: $exception->getMessage(),
                statusCode: Response::HTTP_UNPROCESSABLE_ENTITY,
            );
        }

        return $this->resourceResponse(
            resource: QuestionResource::class,
            data: $questions,
            statusCode: Response::HTTP_CREATED,
        );
    }
}
