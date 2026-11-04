<?php

namespace Tests\Unit\Services\Domain\Event;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\Event\EventStatsFetchService;
use Illuminate\Database\DatabaseManager;
use Mockery;
use ReflectionMethod;
use Tests\TestCase;

class EventStatsFetchServiceDateRangeTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Mockery::close();
        parent::tearDown();
    }

    public function testLastDaysPresetsCoverTodayAndTheDaysBefore(): void
    {
        Carbon::setTestNow('2026-11-06 15:30:00');

        $this->assertSame(['2026-10-24 00:00:00', '2026-11-06 15:30:00'], $this->resolve('last_14_days'));
        $this->assertSame(['2026-10-31 00:00:00', '2026-11-06 15:30:00'], $this->resolve('last_7_days'));
        $this->assertSame(['2026-09-08 00:00:00', '2026-11-06 15:30:00'], $this->resolve('last_60_days'));
    }

    public function testAllTimeStartsOnTheFirstDayOfActivity(): void
    {
        Carbon::setTestNow('2026-11-06 15:30:00');

        $this->assertSame(['2026-08-14 00:00:00', '2026-11-06 15:30:00'], $this->resolveAllTime('2026-08-14', null));
    }

    public function testAllTimeStartsOnTheEventsCreationWithoutActivity(): void
    {
        Carbon::setTestNow('2026-11-06 15:30:00');

        $this->assertSame(['2026-10-02 00:00:00', '2026-11-06 15:30:00'], $this->resolveAllTime(null, '2026-10-02 18:12:45'));
    }

    public function testAllTimeNeverStartsAfterToday(): void
    {
        Carbon::setTestNow('2026-11-06 15:30:00');

        $this->assertSame(['2026-11-06 00:00:00', '2026-11-06 15:30:00'], $this->resolveAllTime('2026-12-01', null));
    }

    private function resolveAllTime(?string $firstDay, ?string $createdAt): array
    {
        $db = Mockery::mock(DatabaseManager::class);
        $db->shouldReceive('selectOne')->once()->andReturn((object)['min_date' => $firstDay]);
        $events = Mockery::mock(EventRepositoryInterface::class);
        if ($createdAt === null) {
            $events->shouldNotReceive('findById');
        } else {
            $events->shouldReceive('findById')->once()->with(1)
                ->andReturn((new EventDomainObject())->setCreatedAt($createdAt));
        }

        $method = new ReflectionMethod(EventStatsFetchService::class, 'resolveStatsDateRange');

        return $method->invoke(new EventStatsFetchService($db, $events), 1, 'all_time');
    }

    private function resolve(string $preset): array
    {
        $db = Mockery::mock(DatabaseManager::class);
        $db->shouldNotReceive('selectOne');
        $events = Mockery::mock(EventRepositoryInterface::class);
        $events->shouldNotReceive('findById');

        $method = new ReflectionMethod(EventStatsFetchService::class, 'resolveStatsDateRange');

        return $method->invoke(new EventStatsFetchService($db, $events), 1, $preset);
    }
}
