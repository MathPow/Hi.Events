<?php

namespace Tests\Unit\Services\Domain\Organizer;

use HiEvents\DomainObjects\Enums\OrganizerAchievement;
use HiEvents\DomainObjects\OrganizerAchievementDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\DTO\Organizer\OrganizerAchievementMetricsDTO;
use HiEvents\Repository\Interfaces\OrganizerAchievementRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Domain\Organizer\DTO\OrganizerAchievementDTO;
use HiEvents\Services\Domain\Organizer\OrganizerAchievementService;
use Illuminate\Database\UniqueConstraintViolationException;
use Mockery as m;
use Tests\TestCase;

class OrganizerAchievementServiceTest extends TestCase
{
    private OrganizerRepositoryInterface $organizerRepository;
    private OrganizerAchievementRepositoryInterface $achievementRepository;
    private OrganizerAchievementService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organizerRepository = m::mock(OrganizerRepositoryInterface::class);
        $this->achievementRepository = m::mock(OrganizerAchievementRepositoryInterface::class);

        $this->service = new OrganizerAchievementService($this->organizerRepository, $this->achievementRepository);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    private function metrics(array $overrides = []): OrganizerAchievementMetricsDTO
    {
        return new OrganizerAchievementMetricsDTO(...array_merge([
            'events_created' => 0,
            'merchandise_sold' => false,
            'active_attendees' => 0,
            'returning_attendees' => 0,
            'events_held' => 0,
            'promo_code_orders' => 0,
            'regions_held' => 0,
            'first_time_attendees' => 0,
        ], $overrides));
    }

    private function organizer(): OrganizerDomainObject
    {
        return (new OrganizerDomainObject())->setId(7)->setCurrency('CAD');
    }

    private function record(OrganizerAchievement $achievement, ?string $seenAt = null): OrganizerAchievementDomainObject
    {
        return (new OrganizerAchievementDomainObject())
            ->setId(1)
            ->setOrganizerId(7)
            ->setAchievement($achievement->value)
            ->setEarnedAt('2026-10-01 12:00:00')
            ->setSeenAt($seenAt);
    }

    /**
     * @return array<string, OrganizerAchievementDTO>
     */
    private function byKey(array $achievements): array
    {
        return collect($achievements)->keyBy('key')->all();
    }

    public function testTheThirteenAchievementsComeInDisplayOrder(): void
    {
        $this->organizerRepository->shouldReceive('getAchievementMetrics')->with(7)->andReturn($this->metrics());
        $this->achievementRepository->shouldReceive('findWhere')->andReturn(collect());
        $this->achievementRepository->shouldNotReceive('create');

        $achievements = $this->service->getAchievements($this->organizer());

        $this->assertCount(13, $achievements);
        $this->assertSame(OrganizerAchievement::valuesArray(), array_column($achievements, 'key'));
        $this->assertSame('first_event', $achievements[0]->key);
        $this->assertSame('first_time_attendees', $achievements[12]->key);
        $this->assertNull($achievements[0]->earned_at);
        $this->assertFalse($achievements[0]->is_new);
    }

    public function testReachingATargetSavesTheAchievementAsNew(): void
    {
        $this->organizerRepository->shouldReceive('getAchievementMetrics')->andReturn($this->metrics([
            'events_created' => 2,
            'active_attendees' => 40,
        ]));
        $this->achievementRepository->shouldReceive('findWhere')->andReturn(collect());
        $this->achievementRepository->shouldReceive('create')
            ->once()
            ->withArgs(fn(array $attributes) => $attributes['organizer_id'] === 7
                && $attributes['achievement'] === OrganizerAchievement::FirstEvent->value
                // The domain object only takes dates as strings
                && is_string($attributes['earned_at']))
            ->andReturn($this->record(OrganizerAchievement::FirstEvent));

        $achievements = $this->byKey($this->service->getAchievements($this->organizer()));

        $this->assertTrue($achievements['first_event']->is_new);
        $this->assertSame(1, $achievements['first_event']->current);
        $this->assertSame('2026-10-01 12:00:00', $achievements['first_event']->earned_at);
        $this->assertSame(40, $achievements['hundred_attendees']->current);
        $this->assertSame(100, $achievements['hundred_attendees']->target);
        $this->assertNull($achievements['hundred_attendees']->earned_at);
    }

    public function testAnEarnedAchievementStaysEarnedWhenTheDataGoesBackDown(): void
    {
        // The only event was deleted after the achievement was earned.
        $this->organizerRepository->shouldReceive('getAchievementMetrics')->andReturn($this->metrics());
        $this->achievementRepository->shouldReceive('findWhere')->andReturn(collect([
            $this->record(OrganizerAchievement::FirstEvent, seenAt: '2026-10-02 09:00:00'),
        ]));
        $this->achievementRepository->shouldNotReceive('create');

        $achievements = $this->byKey($this->service->getAchievements($this->organizer()));

        $this->assertSame('2026-10-01 12:00:00', $achievements['first_event']->earned_at);
        $this->assertSame(1, $achievements['first_event']->current);
        $this->assertFalse($achievements['first_event']->is_new);
    }

    public function testTwoPagesSavingTheSameAchievementAtOnceKeepTheFirst(): void
    {
        $this->organizerRepository->shouldReceive('getAchievementMetrics')->andReturn($this->metrics(['events_created' => 1]));
        $this->achievementRepository->shouldReceive('findWhere')->andReturn(collect());
        $this->achievementRepository->shouldReceive('create')
            ->andThrow(new UniqueConstraintViolationException('pgsql', 'insert', [], new \Exception()));
        $this->achievementRepository->shouldReceive('findFirstWhere')
            ->once()
            ->andReturn($this->record(OrganizerAchievement::FirstEvent));

        $achievements = $this->byKey($this->service->getAchievements($this->organizer()));

        $this->assertSame('2026-10-01 12:00:00', $achievements['first_event']->earned_at);
    }

    public function testTheClubsAllCountRegisteredParticipants(): void
    {
        $metrics = $this->metrics(['active_attendees' => 300]);
        $targets = [];

        foreach ([OrganizerAchievement::Club100, OrganizerAchievement::Club250, OrganizerAchievement::Club500,
                     OrganizerAchievement::Club1000, OrganizerAchievement::Club5000, OrganizerAchievement::Club69420] as $club) {
            $this->assertSame(300, $club->progress($metrics));
            $targets[] = $club->target();
        }

        $this->assertSame([100, 250, 500, 1_000, 5_000, 69_420], $targets);
    }

    public function testEachAchievementFollowsItsOwnMeasure(): void
    {
        $metrics = $this->metrics([
            'merchandise_sold' => true,
            'returning_attendees' => 12,
            'events_held' => 2,
            'promo_code_orders' => 7,
            'regions_held' => 3,
            'first_time_attendees' => 49,
        ]);

        $this->assertSame([1, 1], [OrganizerAchievement::FirstMerchandiseSale->progress($metrics), OrganizerAchievement::FirstMerchandiseSale->target()]);
        $this->assertSame([12, 25], [OrganizerAchievement::ReturningAttendees->progress($metrics), OrganizerAchievement::ReturningAttendees->target()]);
        $this->assertSame([2, 3], [OrganizerAchievement::HatTrick->progress($metrics), OrganizerAchievement::HatTrick->target()]);
        $this->assertSame([7, 10], [OrganizerAchievement::SecretCode->progress($metrics), OrganizerAchievement::SecretCode->target()]);
        $this->assertSame([3, 3], [OrganizerAchievement::QuebecTour->progress($metrics), OrganizerAchievement::QuebecTour->target()]);
        $this->assertSame([49, 50], [OrganizerAchievement::Rookies->progress($metrics), OrganizerAchievement::Rookies->target()]);
    }

    public function testMarkingSeenOnlyTouchesUnseenAchievementsOfTheOrganizer(): void
    {
        $this->achievementRepository->shouldReceive('updateWhere')
            ->once()
            ->withArgs(fn(array $attributes, array $where) => array_key_exists('seen_at', $attributes)
                && $where === ['organizer_id' => 7, ['seen_at', 'null', null]])
            ->andReturn(2);

        $this->service->markAllSeen(7);

        $this->addToAssertionCount(m::getContainer()->mockery_getExpectationCount());
    }
}
