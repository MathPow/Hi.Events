<?php

namespace HiEvents\Http\Actions\LiveTracks;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\LiveTrack\LiveTrackResource;
use HiEvents\Services\Application\Handlers\LiveTrack\GetEventLiveTracksHandler;
use Illuminate\Http\JsonResponse;

class GetEventLiveTracksAction extends BaseAction
{
    public function __construct(private readonly GetEventLiveTracksHandler $handler)
    {
    }

    public function __invoke(int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        return $this->resourceResponse(LiveTrackResource::class, $this->handler->forEvent($eventId));
    }
}
