<?php

namespace HiEvents\Services\Application\Handlers\Event;

use HiEvents\Services\Domain\Event\DTO\EventCheckInStatsResponseDTO;
use HiEvents\Services\Domain\Event\EventStatsFetchService;

/**
 * How many of the event's attendees have arrived (« Accueil et scan »).
 */
class GetEventCheckInStatsHandler
{
    public function __construct(
        private readonly EventStatsFetchService $eventStatsFetchService,
    )
    {
    }

    public function handle(int $eventId): EventCheckInStatsResponseDTO
    {
        return $this->eventStatsFetchService->getCheckedInStats($eventId);
    }
}
