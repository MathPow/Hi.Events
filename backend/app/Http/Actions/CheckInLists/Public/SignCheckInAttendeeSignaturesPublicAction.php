<?php

namespace HiEvents\Http\Actions\CheckInLists\Public;

use HiEvents\Exceptions\CannotCheckInException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Attendee\Public\ParticipantSignaturesHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response as HttpResponse;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class SignCheckInAttendeeSignaturesPublicAction extends BaseAction
{
    public function __construct(private readonly ParticipantSignaturesHandler $handler)
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(string $shortId, string $attendeePublicId, Request $request): JsonResponse|Response
    {
        try {
            $this->handler->signForCheckIn($shortId, $attendeePublicId, $request->all(), $request->ip());
        } catch (CannotCheckInException $e) {
            return $this->errorResponse($e->getMessage(), HttpResponse::HTTP_FORBIDDEN);
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->noContentResponse();
    }
}
