<?php

namespace HiEvents\Http\Actions\Attendees\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Attendee\Public\ParticipantSignaturesHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class GetParticipantSignaturesPublicAction extends BaseAction
{
    public function __construct(private readonly ParticipantSignaturesHandler $handler)
    {
    }

    public function __invoke(int $eventId, string $attendeeShortId): JsonResponse|Response
    {
        try {
            $pending = $this->handler->pendingForTicket($eventId, $attendeeShortId);
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->jsonResponse(['data' => $pending->toArray()]);
    }
}
