<?php

namespace Tests\Unit\Services\Domain\Assistant;

use Carbon\Carbon;
use HiEvents\Repository\Interfaces\AssistantUsageRepositoryInterface;
use HiEvents\Services\Domain\Assistant\AssistantQuotaService;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository as Cache;
use Illuminate\Config\Repository;
use Mockery as m;
use Tests\TestCase;

class AssistantQuotaServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function service(int $limit, float $budget = 0, float $spent = 0): AssistantQuotaService
    {
        $usage = m::mock(AssistantUsageRepositoryInterface::class);
        $usage->shouldReceive('getAccountCostSince')->andReturn($spent);

        return new AssistantQuotaService(
            new Cache(new ArrayStore()),
            new Repository(['services' => ['anthropic' => [
                'assistant_daily_limit' => $limit,
                'assistant_weekly_budget_usd' => $budget,
            ]]]),
            $usage,
        );
    }

    public function testCountsTurnsPerAccountUntilTheLimit(): void
    {
        $service = $this->service(2);

        $this->assertSame(2, $service->remaining(1));
        $this->assertTrue($service->consume(1));
        $this->assertTrue($service->consume(1));
        $this->assertFalse($service->consume(1));
        $this->assertSame(0, $service->remaining(1));

        $this->assertSame(2, $service->remaining(2));
    }

    public function testAZeroLimitClosesTheAssistant(): void
    {
        $service = $this->service(0);

        $this->assertFalse($service->consume(1));
        $this->assertSame(0, $service->remaining(1));
    }

    public function testUnderTheWeeklyBudgetTheDailyLimitStillApplies(): void
    {
        $service = $this->service(5, budget: 6, spent: 5.99);

        $this->assertFalse($service->isOverWeeklyBudget(1));
        $this->assertSame(5, $service->remaining(1));
        $this->assertTrue($service->consume(1));
    }

    public function testTheWeeklyBudgetSpentClosesTheAssistantUntilMonday(): void
    {
        $service = $this->service(200, budget: 6, spent: 6.01);

        $this->assertTrue($service->isOverWeeklyBudget(1));
        $this->assertSame(0, $service->remaining(1));
        $this->assertFalse($service->consume(1));
        $this->assertStringContainsString('Monday', $service->refusalMessage(1));
    }

    public function testAZeroBudgetMeansNoWeeklyCap(): void
    {
        $service = $this->service(3, budget: 0, spent: 500);

        $this->assertFalse($service->isOverWeeklyBudget(1));
        $this->assertSame(3, $service->remaining(1));
    }

    public function testTheWeekStartsMondayAtMidnightInQuebec(): void
    {
        // Sunday 23:30 in Quebec is already Monday 04:30 UTC: still last week there.
        Carbon::setTestNow(Carbon::parse('2026-11-23 04:30:00', 'UTC'));

        $usage = m::mock(AssistantUsageRepositoryInterface::class);
        $usage->shouldReceive('getAccountCostSince')
            ->withArgs(fn(int $accountId, Carbon $since) => $since->equalTo(Carbon::parse('2026-11-16 05:00:00', 'UTC')))
            ->once()
            ->andReturn(0.0);

        $service = new AssistantQuotaService(
            new Cache(new ArrayStore()),
            new Repository(['services' => ['anthropic' => ['assistant_daily_limit' => 1, 'assistant_weekly_budget_usd' => 6]]]),
            $usage,
        );

        $this->assertFalse($service->isOverWeeklyBudget(1));
    }
}
