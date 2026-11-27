<?php

namespace HiEvents\Http\Actions\LiveTracks;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\LiveTrack\LiveTrackPointResource;
use HiEvents\Services\Application\Handlers\LiveTrack\GetEventLiveTracksHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class GetLiveTrackPointsAction extends BaseAction
{
    public function __construct(private readonly GetEventLiveTracksHandler $handler)
    {
    }

    public function __invoke(int $eventId, int $liveTrackId): JsonResponse|Response
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        try {
            $points = $this->handler->trail($eventId, $liveTrackId);
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->resourceResponse(LiveTrackPointResource::class, $points);
    }
}
