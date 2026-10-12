<?php

namespace Tests\Unit\DomainObjects;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Status\EventLifecycleStatus;
use Tests\TestCase;

class EventDomainObjectLifecycleTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeEvent(string $startDate, ?string $endDate = null): EventDomainObject
    {
        return (new EventDomainObject)
            ->setTimezone('America/Toronto')
            ->setStartDate($startDate)
            ->setEndDate($endDate);
    }

    public function test_event_without_end_date_is_ongoing_within_default_duration(): void
    {
        Carbon::setTestNow('2026-10-13 01:00:00');

        $event = $this->makeEvent('2026-10-12 18:00:00');

        $this->assertSame(EventLifecycleStatus::ONGOING->name, $event->getLifecycleStatus());
    }

    public function test_event_without_end_date_is_ended_after_default_duration(): void
    {
        Carbon::setTestNow('2026-10-13 02:30:00');

        $event = $this->makeEvent('2026-10-12 18:00:00');

        $this->assertTrue($event->isEventInPast());
        $this->assertSame(EventLifecycleStatus::ENDED->name, $event->getLifecycleStatus());
    }

    public function test_event_with_end_date_uses_it(): void
    {
        Carbon::setTestNow('2026-10-12 23:00:00');

        $event = $this->makeEvent('2026-10-12 18:00:00', '2026-10-13 02:00:00');

        $this->assertSame(EventLifecycleStatus::ONGOING->name, $event->getLifecycleStatus());
    }

    public function test_future_event_is_upcoming(): void
    {
        Carbon::setTestNow('2026-10-12 12:00:00');

        $event = $this->makeEvent('2026-10-12 18:00:00');

        $this->assertSame(EventLifecycleStatus::UPCOMING->name, $event->getLifecycleStatus());
    }
}
