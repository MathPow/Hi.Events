<?php

namespace HiEvents\Resources\Organizer;

use HiEvents\DomainObjects\Enums\OrganizerAchievement;
use HiEvents\DomainObjects\OrganizerAchievementDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Resources\Event\EventResourcePublic;
use HiEvents\Resources\Image\ImageResource;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin OrganizerDomainObject
 */
class OrganizerResourcePublic extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->getId(),
            'name' => $this->getName(),
            'website' => $this->getWebsite(),
            'donation_url' => $this->getDonationUrl(),
            'description' => $this->getDescription(),
            'slug' => $this->getSlug(),
            'status' => $this->getStatus(),
            'images' => $this->when(
                (bool)$this->getImages(),
                fn() => ImageResource::collection($this->getImages())
            ),
            'events' => $this->when(
                condition: !is_null($this->getEvents()),
                value: fn() => EventResourcePublic::collection($this->getEvents())
            ),
            'settings' => $this->when(
                condition: !is_null($this->getOrganizerSettings()),
                value: fn() => new OrganizerSettingsPublicResource($this->getOrganizerSettings())
            ),
            'achievements' => $this->when(
                condition: !is_null($this->getOrganizerAchievements()),
                value: fn() => $this->earnedAchievementsHardestFirst(),
            ),
        ];
    }

    /**
     * Only what was earned and when: the progress towards the others stays private.
     */
    private function earnedAchievementsHardestFirst(): array
    {
        return $this->getOrganizerAchievements()
            ->map(fn(OrganizerAchievementDomainObject $earned) => [
                'achievement' => OrganizerAchievement::tryFrom($earned->getAchievement()),
                'earned_at' => $earned->getEarnedAt(),
            ])
            ->filter(fn(array $earned) => $earned['achievement'] !== null)
            ->sortByDesc(fn(array $earned) => $earned['achievement']->difficulty())
            ->map(fn(array $earned) => [
                'key' => $earned['achievement']->value,
                'earned_at' => $earned['earned_at'],
            ])
            ->values()
            ->all();
    }
}
