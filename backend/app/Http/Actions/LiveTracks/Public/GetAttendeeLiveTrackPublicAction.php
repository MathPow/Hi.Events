<?php

namespace HiEvents\Http\Actions\LiveTracks\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\LiveTrack\LiveTrackResourcePublic;
use HiEvents\Services\Application\Handlers\LiveTrack\AttendeeLiveTrackPublicHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class GetAttendeeLiveTrackPublicAction extends BaseAction
{
    public function __construct(private readonly AttendeeLiveTrackPublicHandler $handler)
    {
    }

    public function __invoke(int $eventId, string $attendeeShortId): JsonResponse|Response
    {
        try {
            $result = $this->handler->get($eventId, $attendeeShortId);
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->jsonResponse([
            'enabled' => $result->enabled,
            'live_track' => $result->liveTrack ? new LiveTrackResourcePublic($result->liveTrack) : null,
        ], wrapInData: true);
    }
}
