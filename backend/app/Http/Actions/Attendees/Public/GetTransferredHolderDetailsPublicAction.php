<?php

namespace HiEvents\Http\Actions\Attendees\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Question\QuestionResourcePublic;
use HiEvents\Services\Application\Handlers\Attendee\Public\TicketTransferPublicHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class GetTransferredHolderDetailsPublicAction extends BaseAction
{
    public function __construct(private readonly TicketTransferPublicHandler $handler)
    {
    }

    public function __invoke(int $eventId, string $attendeeShortId): JsonResponse|Response
    {
        try {
            $questions = $this->handler->pendingDetails($eventId, $attendeeShortId);
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->resourceResponse(QuestionResourcePublic::class, $questions);
    }
}
