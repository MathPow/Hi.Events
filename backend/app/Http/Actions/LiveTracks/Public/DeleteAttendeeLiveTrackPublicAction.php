<?php

namespace HiEvents\Http\Actions\LiveTracks\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\LiveTrack\AttendeeLiveTrackPublicHandler;
use Illuminate\Http\Response;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class DeleteAttendeeLiveTrackPublicAction extends BaseAction
{
    public function __construct(private readonly AttendeeLiveTrackPublicHandler $handler)
    {
    }

    public function __invoke(int $eventId, string $attendeeShortId): Response
    {
        try {
            $this->handler->remove($eventId, $attendeeShortId);
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        }

        return $this->deletedResponse();
    }
}
