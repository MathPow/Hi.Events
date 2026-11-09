<?php

namespace HiEvents\Http\Actions\Attendees\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Attendee\Public\ParticipantSignaturesHandler;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class SignParticipantSignaturesPublicAction extends BaseAction
{
    public function __construct(private readonly ParticipantSignaturesHandler $handler)
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(int $eventId, string $attendeeShortId, Request $request): Response
    {
        try {
            $this->handler->signForTicket($eventId, $attendeeShortId, $request->all(), $request->ip());
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->noContentResponse();
    }
}
