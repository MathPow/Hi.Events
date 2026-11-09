<?php

namespace HiEvents\Http\Actions\CheckInLists\Public;

use HiEvents\Exceptions\CannotCheckInException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Attendee\Public\ParticipantSignaturesHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class GetCheckInAttendeeSignaturesPublicAction extends BaseAction
{
    public function __construct(private readonly ParticipantSignaturesHandler $handler)
    {
    }

    public function __invoke(string $shortId, string $attendeePublicId): JsonResponse|Response
    {
        try {
            $pending = $this->handler->pendingForCheckIn($shortId, $attendeePublicId);
        } catch (CannotCheckInException $e) {
            return $this->errorResponse($e->getMessage(), HttpResponse::HTTP_FORBIDDEN);
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->jsonResponse(['data' => $pending->toArray()]);
    }
}
