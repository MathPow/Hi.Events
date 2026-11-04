<?php

namespace Tests\Unit\Resources\Organizer;

use HiEvents\DomainObjects\Enums\OrganizerAchievement;
use HiEvents\DomainObjects\OrganizerAchievementDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Resources\Organizer\OrganizerResourcePublic;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\MissingValue;
use Tests\TestCase;

class OrganizerResourcePublicTest extends TestCase
{
    public function testEarnedAchievementsComeHardestFirstWithTheirDifficultyButNotTheProgress(): void
    {
        $organizer = $this->organizer()->setOrganizerAchievements(collect([
            $this->earned('first_event', '2026-10-28 14:00:00'),
            $this->earned('attendees_1000', '2026-11-04 09:00:00'),
            $this->earned('hat_trick', '2026-11-01 18:30:00'),
            $this->earned('hundred_attendees', '2026-11-02 10:00:00'),
        ]));

        $resource = (new OrganizerResourcePublic($organizer))->toArray(Request::create('/'));

        $this->assertSame([
            ['key' => 'attendees_1000', 'difficulty' => 11, 'earned_at' => '2026-11-04 09:00:00'],
            ['key' => 'hat_trick', 'difficulty' => 5, 'earned_at' => '2026-11-01 18:30:00'],
            ['key' => 'hundred_attendees', 'difficulty' => 3, 'earned_at' => '2026-11-02 10:00:00'],
            ['key' => 'first_event', 'difficulty' => 1, 'earned_at' => '2026-10-28 14:00:00'],
        ], $resource['achievements']);
    }

    public function testAnAchievementNoLongerInTheListIsLeftOut(): void
    {
        $organizer = $this->organizer()->setOrganizerAchievements(collect([
            $this->earned('retired_achievement', '2026-10-01 12:00:00'),
            $this->earned('first_event', '2026-10-28 14:00:00'),
        ]));

        $resource = (new OrganizerResourcePublic($organizer))->toArray(Request::create('/'));

        $this->assertSame([['key' => 'first_event', 'difficulty' => 1, 'earned_at' => '2026-10-28 14:00:00']], $resource['achievements']);
    }

    public function testAchievementsAreLeftOutWhenTheyWereNotLoaded(): void
    {
        $resource = (new OrganizerResourcePublic($this->organizer()))->toArray(Request::create('/'));

        $this->assertInstanceOf(MissingValue::class, $resource['achievements']);
    }

    public function testEveryAchievementHasItsOwnDifficulty(): void
    {
        $difficulties = array_map(fn(OrganizerAchievement $achievement) => $achievement->difficulty(), OrganizerAchievement::cases());

        $this->assertSame(count($difficulties), count(array_unique($difficulties)));
    }

    private function organizer(): OrganizerDomainObject
    {
        return (new OrganizerDomainObject())->setId(1)->setName('Club Plein Air Boréal')->setStatus('LIVE');
    }

    private function earned(string $key, string $earnedAt): OrganizerAchievementDomainObject
    {
        return (new OrganizerAchievementDomainObject())->setAchievement($key)->setEarnedAt($earnedAt);
    }
}
