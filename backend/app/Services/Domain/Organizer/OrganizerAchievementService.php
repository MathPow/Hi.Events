<?php

namespace HiEvents\Services\Domain\Organizer;

use HiEvents\DomainObjects\Enums\OrganizerAchievement;
use HiEvents\DomainObjects\Generated\OrganizerAchievementDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerAchievementDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\Interfaces\OrganizerAchievementRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Domain\Organizer\DTO\OrganizerAchievementDTO;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;

/**
 * Achievements are worked out from the organizer's data each time they are read,
 * and saved the first time they are reached: an achievement stays earned even if
 * the event that earned it is deleted later.
 */
class OrganizerAchievementService
{
    public function __construct(
        private readonly OrganizerRepositoryInterface            $organizerRepository,
        private readonly OrganizerAchievementRepositoryInterface $achievementRepository,
    )
    {
    }

    /**
     * @return OrganizerAchievementDTO[] in display order
     */
    public function getAchievements(OrganizerDomainObject $organizer): array
    {
        $metrics = $this->organizerRepository->getAchievementMetrics($organizer->getId(), $organizer->getCurrency());

        $earned = $this->achievementRepository
            ->findWhere([OrganizerAchievementDomainObjectAbstract::ORGANIZER_ID => $organizer->getId()])
            ->keyBy(fn(OrganizerAchievementDomainObject $record) => $record->getAchievement());

        $achievements = [];

        foreach (OrganizerAchievement::cases() as $achievement) {
            $current = $achievement->progress($metrics);
            $record = $earned->get($achievement->value);

            if ($record === null && $current >= $achievement->target()) {
                $record = $this->saveEarned($organizer->getId(), $achievement);
            }

            $achievements[] = new OrganizerAchievementDTO(
                key: $achievement->value,
                current: $record === null ? $current : $achievement->target(),
                target: $achievement->target(),
                earned_at: $record?->getEarnedAt(),
                is_new: $record !== null && $record->getSeenAt() === null,
            );
        }

        return $achievements;
    }

    public function markAllSeen(int $organizerId): void
    {
        $this->achievementRepository->updateWhere(
            attributes: [OrganizerAchievementDomainObjectAbstract::SEEN_AT => Carbon::now()],
            where: [
                OrganizerAchievementDomainObjectAbstract::ORGANIZER_ID => $organizerId,
                [OrganizerAchievementDomainObjectAbstract::SEEN_AT, 'null', null],
            ],
        );
    }

    private function saveEarned(int $organizerId, OrganizerAchievement $achievement): OrganizerAchievementDomainObject
    {
        $attributes = [
            OrganizerAchievementDomainObjectAbstract::ORGANIZER_ID => $organizerId,
            OrganizerAchievementDomainObjectAbstract::ACHIEVEMENT => $achievement->value,
        ];

        try {
            return $this->achievementRepository->create([
                ...$attributes,
                OrganizerAchievementDomainObjectAbstract::EARNED_AT => Carbon::now()->toDateTimeString(),
            ]);
        } catch (UniqueConstraintViolationException) {
            // Two pages loading at once: the other request saved it first
            return $this->achievementRepository->findFirstWhere($attributes);
        }
    }
}
