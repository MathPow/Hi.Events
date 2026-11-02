<?php

namespace Tests\Unit\Services\Domain\Event;

use Carbon\Carbon;
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
