<?php

namespace HiEvents\Services\Application\Handlers\Organizer\Achievements;

use HiEvents\Exceptions\OrganizerNotFoundException;
use HiEvents\Services\Domain\Organizer\DTO\OrganizerAchievementDTO;
use HiEvents\Services\Domain\Organizer\OrganizerAchievementService;
use HiEvents\Services\Domain\Organizer\OrganizerFetchService;

class GetOrganizerAchievementsHandler
{
    public function __construct(
        private readonly OrganizerFetchService       $organizerFetchService,
        private readonly OrganizerAchievementService $achievementService,
    )
    {
    }

    /**
     * @return OrganizerAchievementDTO[]
     * @throws OrganizerNotFoundException
     */
    public function handle(int $organizerId, int $accountId): array
    {
        return $this->achievementService->getAchievements(
            $this->organizerFetchService->fetchOrganizer($organizerId, $accountId),
        );
    }
}
