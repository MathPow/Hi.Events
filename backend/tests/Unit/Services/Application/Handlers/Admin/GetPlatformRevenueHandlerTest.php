<?php

namespace Tests\Unit\Services\Application\Handlers\Admin;

use HiEvents\Services\Application\Handlers\Admin\DTO\GetPlatformRevenueDTO;
use HiEvents\Services\Application\Handlers\Admin\GetPlatformRevenueHandler;
use Illuminate\Config\Repository as ConfigRepository;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class GetPlatformRevenueHandlerTest extends TestCase
{
    private array $queries = [];

    private function handler(float $processingFeePercentage = 2.9): GetPlatformRevenueHandler
    {
        return new GetPlatformRevenueHandler(new ConfigRepository([
            'services' => [
                'stripe' => [
                    'processing_fee_percentage' => $processingFeePercentage,
                ],
            ],
        ]));
    }

    /**
     * @param array<int, array<int, object>> $results one result set per DB::select call, in call order
     */
    private function mockDatabase(array $results): void
    {
        $this->queries = [];
        $remaining = $results;

        DB::shouldReceive('select')->andReturnUsing(function (string $query, array $bindings) use (&$remaining) {
            $this->queries[] = ['query' => $query, 'bindings' => $bindings];

            return array_shift($remaining) ?? [];
        });
    }

    private function row(array $attributes): object
    {
        return (object)$attributes;
    }

    public function testHandleAggregatesContributionsAndCommissions(): void
    {
        $this->mockDatabase([
            // All time, by currency
            [
                $this->row(['bucket' => 'CAD', 'amount' => '120.50', 'orders_count' => 8]),
                $this->row(['bucket' => 'EUR', 'amount' => '20.00', 'orders_count' => 2]),
            ],
            [
                $this->row(['bucket' => 'CAD', 'amount' => '45.25', 'orders_count' => 0]),
            ],
            // Recent window, by currency
            [
                $this->row(['bucket' => 'CAD', 'amount' => '30.00', 'orders_count' => 3]),
            ],
            [
                $this->row(['bucket' => 'CAD', 'amount' => '10.00', 'orders_count' => 0]),
            ],
            // Monthly
            [
                $this->row(['bucket' => '2026-08', 'amount' => '90.50', 'orders_count' => 5]),
            ],
            [
                $this->row(['bucket' => '2026-09', 'amount' => '15.00', 'orders_count' => 0]),
            ],
            // Top contributors
            [
                $this->row([
                    'email' => 'gros.donateur@example.com',
                    'first_name' => 'Camille',
                    'last_name' => 'Roy',
                    'currency' => 'CAD',
                    'amount' => '40.00',
                    'orders_count' => 2,
                    'last_contribution_at' => '2026-09-01 12:00:00',
                ]),
            ],
        ]);

        $result = $this->handler()->handle(new GetPlatformRevenueDTO(days: 30, months: 12));

        $this->assertSame(140.5, $result->contributions_total);
        $this->assertSame(45.25, $result->commissions_total);
        $this->assertSame(185.75, $result->total);
        $this->assertSame(10, $result->contributions_orders);

        $this->assertSame(30.0, $result->recent_contributions_total);
        $this->assertSame(10.0, $result->recent_commissions_total);
        $this->assertSame(40.0, $result->recent_total);
        $this->assertSame(3, $result->recent_contributions_orders);

        $this->assertSame([
            [
                'currency' => 'CAD',
                'contributions' => 120.5,
                'contributions_orders' => 8,
                'commissions' => 45.25,
                'total' => 165.75,
            ],
            [
                'currency' => 'EUR',
                'contributions' => 20.0,
                'contributions_orders' => 2,
                'commissions' => 0.0,
                'total' => 20.0,
            ],
        ], $result->by_currency);

        $this->assertSame(['2026-08', '2026-09'], array_column($result->monthly, 'month'));
        $this->assertSame(90.5, $result->monthly[0]['total']);
        $this->assertSame(15.0, $result->monthly[1]['commissions']);
        $this->assertSame(30, $result->days);

        $this->assertSame([
            [
                'email' => 'gros.donateur@example.com',
                'first_name' => 'Camille',
                'last_name' => 'Roy',
                'currency' => 'CAD',
                'amount' => 40.0,
                'orders_count' => 2,
                'last_contribution_at' => '2026-09-01 12:00:00',
            ],
        ], $result->top_contributors);
    }

    public function testTopContributorsAreGroupedByBuyerAndCapped(): void
    {
        $this->mockDatabase([]);

        $this->handler()->handle(new GetPlatformRevenueDTO(topContributors: 5));

        $topContributorsQuery = collect($this->queries)->first(fn(array $q) => str_contains($q['query'], 'lower(o.email)'));

        $this->assertStringContainsString('GROUP BY lower(o.email), o.currency', $topContributorsQuery['query']);
        $this->assertStringContainsString('ORDER BY amount DESC', $topContributorsQuery['query']);
        $this->assertSame(5, $topContributorsQuery['bindings']['limit']);
    }

    public function testCommissionsExcludeTheContributionCarriedByTheStripeApplicationFee(): void
    {
        $this->mockDatabase([]);

        $this->handler(processingFeePercentage: 2.9)->handle(new GetPlatformRevenueDTO());

        $commissionQuery = $this->queries[1];

        $this->assertStringContainsString('order_application_fees', $commissionQuery['query']);
        $this->assertStringContainsString('platform_contribution', $commissionQuery['query']);
        $this->assertSame('STRIPE', $commissionQuery['bindings']['stripe']);
        $this->assertEqualsWithDelta(0.971, $commissionQuery['bindings']['contributionRetention'], 0.0001);
    }

    public function testTheWholeContributionIsKeptWhenNoProcessingFeeIsConfigured(): void
    {
        $this->mockDatabase([]);

        $this->handler(processingFeePercentage: 0)->handle(new GetPlatformRevenueDTO());

        $this->assertSame(1.0, $this->queries[1]['bindings']['contributionRetention']);
    }

    public function testAllTimeQueriesAreNotDateBound(): void
    {
        $this->mockDatabase([]);

        $this->handler()->handle(new GetPlatformRevenueDTO(days: 7));

        $this->assertArrayNotHasKey('since', $this->queries[0]['bindings']);
        $this->assertArrayNotHasKey('since', $this->queries[1]['bindings']);
        $this->assertArrayHasKey('since', $this->queries[2]['bindings']);
        $this->assertArrayHasKey('since', $this->queries[3]['bindings']);
    }

    public function testBreakdownByEventAndOrganizerWithPercentages(): void
    {
        $this->mockDatabase([[], [], [], [], [], [], [], [
            $this->row(['event_id' => 1, 'currency' => 'CAD', 'amount' => '4.00']),
            $this->row(['event_id' => 3, 'currency' => 'CAD', 'amount' => '2.00']),
        ], [
            $this->row(['event_id' => 1, 'event_title' => 'Course', 'organizer_id' => 10, 'organizer_name' => 'Boreal', 'currency' => 'CAD', 'paid_orders' => 20, 'contributions_orders' => 5, 'contributions' => '6.00']),
            $this->row(['event_id' => 2, 'event_title' => 'Rando', 'organizer_id' => 10, 'organizer_name' => 'Boreal', 'currency' => 'CAD', 'paid_orders' => 10, 'contributions_orders' => 0, 'contributions' => '0']),
            $this->row(['event_id' => 3, 'event_title' => 'Velo', 'organizer_id' => 11, 'organizer_name' => 'Dehors', 'currency' => 'CAD', 'paid_orders' => 4, 'contributions_orders' => 2, 'contributions' => '2.00']),
        ]]);

        $result = $this->handler()->handle(new GetPlatformRevenueDTO(days: 30, breakdownDays: 30));

        $commissionQuery = $this->queries[7];
        $this->assertStringContainsString('GROUP BY o.event_id, f.currency', $commissionQuery['query']);
        $this->assertArrayHasKey('since', $commissionQuery['bindings']);

        $breakdownQuery = end($this->queries);
        $this->assertStringContainsString('GROUP BY e.id', $breakdownQuery['query']);
        $this->assertStringContainsString('o.total_gross > 0', $breakdownQuery['query']);
        $this->assertArrayHasKey('since', $breakdownQuery['bindings']);

        $course = $result->by_event[0];
        $this->assertSame('Course', $course['event_title']);
        $this->assertSame(4.0, $course['commissions']);
        $this->assertSame(10.0, $course['total']);
        $this->assertSame(25.0, $course['participation_rate']);
        $this->assertSame(71.4, $course['share']);
        $this->assertSame(1.2, $course['average_contribution']);

        $this->assertSame(0.0, $result->by_event[2]['participation_rate']);
        $this->assertSame(0.0, $result->by_event[2]['average_contribution']);

        $boreal = $result->by_organizer[0];
        $this->assertSame('Boreal', $boreal['organizer_name']);
        $this->assertSame(2, $boreal['events_count']);
        $this->assertSame(30, $boreal['paid_orders']);
        $this->assertSame(16.7, $boreal['participation_rate']);
        $this->assertSame(4.0, $boreal['commissions']);
        $this->assertSame(71.4, $boreal['share']);
        $this->assertSame(28.6, $result->by_organizer[1]['share']);
    }

    public function testBreakdownCoversAllTimeByDefault(): void
    {
        $this->mockDatabase([]);

        $this->handler()->handle(new GetPlatformRevenueDTO(days: 7));

        $breakdownQuery = end($this->queries);
        $this->assertStringContainsString('GROUP BY e.id', $breakdownQuery['query']);
        $this->assertArrayNotHasKey('since', $breakdownQuery['bindings']);
        $this->assertArrayNotHasKey('since', $this->queries[7]['bindings']);
    }
}
