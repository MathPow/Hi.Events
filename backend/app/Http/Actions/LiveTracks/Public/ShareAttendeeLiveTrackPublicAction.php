<?php

namespace HiEvents\Http\Actions\LiveTracks\Public;

use HiEvents\Exceptions\InvalidLiveTrackLinkException;
use HiEvents\Exceptions\LiveTrackingDisabledException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\LiveTrack\ShareLiveTrackRequest;
use HiEvents\Resources\LiveTrack\LiveTrackResourcePublic;
use HiEvents\Services\Application\Handlers\LiveTrack\AttendeeLiveTrackPublicHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response as ResponseCodes;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class ShareAttendeeLiveTrackPublicAction extends BaseAction
{
    public function __construct(private readonly AttendeeLiveTrackPublicHandler $handler)
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(ShareLiveTrackRequest $request, int $eventId, string $attendeeShortId): JsonResponse|Response
    {
        try {
            $liveTrack = $this->handler->share($eventId, $attendeeShortId, $request->validated('link'));
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        } catch (InvalidLiveTrackLinkException $exception) {
            throw ValidationException::withMessages(['link' => $exception->getMessage()]);
        } catch (LiveTrackingDisabledException $exception) {
            return $this->errorResponse($exception->getMessage(), ResponseCodes::HTTP_CONFLICT);
        }

        return $this->resourceResponse(LiveTrackResourcePublic::class, $liveTrack);
    }
}
