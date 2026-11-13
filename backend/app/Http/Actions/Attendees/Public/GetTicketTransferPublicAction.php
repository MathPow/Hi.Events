<?php

namespace HiEvents\Http\Actions\Attendees\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Attendee\Public\TicketTransferPublicHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class GetTicketTransferPublicAction extends BaseAction
{
    public function __construct(private readonly TicketTransferPublicHandler $handler)
    {
    }

    public function __invoke(int $eventId, string $attendeeShortId): JsonResponse|Response
    {
        try {
            $eligibility = $this->handler->eligibility($eventId, $attendeeShortId);
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->jsonResponse([
            'enabled' => $eligibility->enabled,
            'can_transfer' => $eligibility->isAllowed(),
            'deadline' => $eligibility->deadline,
            'refusal' => $eligibility->refusal?->value,
            'refusal_message' => $eligibility->refusal?->message(),
        ], wrapInData: true);
    }
}
