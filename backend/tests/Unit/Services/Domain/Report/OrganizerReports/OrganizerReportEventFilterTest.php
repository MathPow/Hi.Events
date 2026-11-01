<?php

namespace Tests\Unit\Services\Domain\Report\OrganizerReports;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Domain\Report\AbstractOrganizerReportService;
use HiEvents\Services\Domain\Report\OrganizerReports\CheckInSummaryReport;
use HiEvents\Services\Domain\Report\OrganizerReports\EventsPerformanceReport;
use HiEvents\Services\Domain\Report\OrganizerReports\MerchSalesReport;
use HiEvents\Services\Domain\Report\OrganizerReports\RevenueSummaryReport;
use HiEvents\Services\Domain\Report\OrganizerReports\TaxSummaryReport;
use Illuminate\Cache\Repository;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Carbon;
use Mockery as m;
use Tests\TestCase;

/**
 * Every organizer report can be narrowed to one event (« Tous les événements »).
 */
class OrganizerReportEventFilterTest extends TestCase
{
    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    /**
     * @param class-string<AbstractOrganizerReportService> $reportClass
     */
    private function sql(string $reportClass, ?int $eventId): string
    {
        $cache = m::mock(Repository::class);
        $cache->shouldReceive('remember')->andReturnUsing(fn($key, $ttl, $callback) => $callback());

        $sql = '';
        $database = m::mock(DatabaseManager::class);
        $database->shouldReceive('select')->andReturnUsing(function (string $query, array $bindings) use (&$sql) {
            $sql = $query;
            $this->assertSame(['organizer_id' => 3], $bindings);
            return [];
        });

        $organizers = m::mock(OrganizerRepositoryInterface::class);
        $organizers->shouldReceive('findById')->andReturn((new OrganizerDomainObject())->setTimezone('America/Montreal'));

        (new $reportClass($cache, $database, $organizers))->generateReport(
            organizerId: 3,
            currency: 'CAD',
            startDate: Carbon::parse('2026-08-01 12:00', 'America/Montreal'),
            endDate: Carbon::parse('2026-10-31 12:00', 'America/Montreal'),
            eventId: $eventId,
        );

        return $sql;
    }

    public function testEachReportNarrowsToTheChosenEvent(): void
    {
        foreach ([
                     RevenueSummaryReport::class,
                     EventsPerformanceReport::class,
                     TaxSummaryReport::class,
                     CheckInSummaryReport::class,
                     MerchSalesReport::class,
                 ] as $reportClass) {
            $this->assertStringContainsString('AND e.id = 12', $this->sql($reportClass, 12), $reportClass);
            $this->assertStringNotContainsString('AND e.id =', $this->sql($reportClass, null), $reportClass);
        }
    }

    public function testMerchSalesCountsOnlyProductsThatAreNotTickets(): void
    {
        $sql = $this->sql(MerchSalesReport::class, null);

        $this->assertStringContainsString("oi.product_type = 'GENERAL'", $sql);
        $this->assertStringContainsString("o.status = 'COMPLETED'", $sql);
        $this->assertStringContainsString("BETWEEN '2026-08-01' AND '2026-10-31'", $sql);
    }

    public function testEventsPerformanceHasTheTicketCapacity(): void
    {
        $sql = $this->sql(EventsPerformanceReport::class, null);

        $this->assertStringContainsString('ts.ticket_capacity', $sql);
        $this->assertStringContainsString("p.product_type = 'TICKET'", $sql);
    }
}
