<?php

namespace Tests\Unit\Services\Domain\Event;

use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\GetEventCheckInStatsHandler;
use HiEvents\Services\Domain\Event\EventStatsFetchService;
use Illuminate\Database\DatabaseManager;
use Mockery;
use Tests\TestCase;

class EventStatsFetchServiceCheckInStatsTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testCountsTheAttendeesWithACheckInOnAnyList(): void
    {
        $db = Mockery::mock(DatabaseManager::class);
        $db->shouldReceive('selectOne')->once()
            ->with(Mockery::on(fn(string $sql) => str_contains($sql, 'attendee_check_ins')
                && str_contains($sql, 'aci.deleted_at IS NULL')
                && !str_contains($sql, 'checked_in_at')), ['eventId' => 9])
            ->andReturn((object)['total_count' => 112, 'checked_in_count' => 41]);

        $service = new EventStatsFetchService($db, Mockery::mock(EventRepositoryInterface::class));
        $stats = (new GetEventCheckInStatsHandler($service))->handle(9);

        $this->assertSame(41, $stats->total_checked_in_attendees);
        $this->assertSame(112, $stats->total_attendees);
    }
}
