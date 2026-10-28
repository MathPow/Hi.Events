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
            'organizer_page_images' => 0,
            'payments_connected' => false,
            'live_events' => 0,
            'has_participant_order' => false,
            'has_check_in' => false,
            'active_attendees' => 0,
            'regular_attendees' => 0,
            'net_sales' => 0.0,
            'events_held' => 0,
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

    public function testTheTenAchievementsComeInDisplayOrder(): void
    {
        $this->organizerRepository->shouldReceive('getAchievementMetrics')->with(7, 'CAD')->andReturn($this->metrics());
        $this->achievementRepository->shouldReceive('findWhere')->andReturn(collect());
        $this->achievementRepository->shouldNotReceive('create');

        $achievements = $this->service->getAchievements($this->organizer());

        $this->assertCount(10, $achievements);
        $this->assertSame(OrganizerAchievement::valuesArray(), array_column($achievements, 'key'));
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

    public function testSalesCountInWholeDollarsTowardTheSummit(): void
    {
        $this->assertSame(9_999, OrganizerAchievement::SalesSummit->progress($this->metrics(['net_sales' => 9_999.99])));
        $this->assertSame(10_000, OrganizerAchievement::SalesSummit->target());
    }

    public function testTheOrganizerPageNeedsBothALogoAndACover(): void
    {
        $this->assertSame(1, OrganizerAchievement::OrganizerPage->progress($this->metrics(['organizer_page_images' => 1])));
        $this->assertSame(2, OrganizerAchievement::OrganizerPage->target());
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
