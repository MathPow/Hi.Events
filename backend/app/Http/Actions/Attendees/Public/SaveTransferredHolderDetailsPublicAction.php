<?php

namespace HiEvents\Http\Actions\Attendees\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Attendee\Public\TicketTransferPublicHandler;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Throwable;

class SaveTransferredHolderDetailsPublicAction extends BaseAction
{
    public function __construct(private readonly TicketTransferPublicHandler $handler)
    {
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function __invoke(Request $request, int $eventId, string $attendeeShortId): Response
    {
        try {
            $this->handler->completeDetails($eventId, $attendeeShortId, $request->only('questions'));
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->noContentResponse();
    }
}
