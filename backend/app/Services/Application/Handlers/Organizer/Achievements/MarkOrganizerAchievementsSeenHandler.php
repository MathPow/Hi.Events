<?php

namespace HiEvents\Services\Application\Handlers\Organizer\Achievements;

use HiEvents\Exceptions\OrganizerNotFoundException;
use HiEvents\Services\Domain\Organizer\OrganizerAchievementService;
use HiEvents\Services\Domain\Organizer\OrganizerFetchService;

class MarkOrganizerAchievementsSeenHandler
{
    public function __construct(
        private readonly OrganizerFetchService       $organizerFetchService,
        private readonly OrganizerAchievementService $achievementService,
    )
    {
    }

    /**
     * @throws OrganizerNotFoundException
     */
    public function handle(int $organizerId, int $accountId): void
    {
        $organizer = $this->organizerFetchService->fetchOrganizer($organizerId, $accountId);

        $this->achievementService->markAllSeen($organizer->getId());
    }
}
