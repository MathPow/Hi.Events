<?php

namespace Tests\Unit\Services\Domain\Assistant;

use HiEvents\Services\Domain\Assistant\AssistantPricing;
use Tests\TestCase;

class AssistantPricingTest extends TestCase
{
    public function testPricesEachKindOfTokenForSonnet(): void
    {
        $pricing = new AssistantPricing();

        // 1M input ($2) + 1M 5-minute cache write ($2.50) + 1M cache read ($0.20) + 1M output ($10).
        $cost = $pricing->cost('claude-sonnet-5-5', 1_000_000, 1_000_000, 0, 1_000_000, 1_000_000);

        $this->assertEqualsWithDelta(14.70, $cost, 0.000001);
    }

    public function testOneHourCacheWritesCostTwiceTheInput(): void
    {
        $cost = (new AssistantPricing())->cost('claude-opus-5-5', 0, 0, 1_000_000, 0, 0);

        $this->assertEqualsWithDelta(8.00, $cost, 0.000001);
    }

    public function testTheLongestModelIdWins(): void
    {
        $pricing = new AssistantPricing();

        $this->assertEqualsWithDelta(4.00, $pricing->cost('claude-opus-5-5', 1_000_000, 0, 0, 0, 0), 0.000001);
        $this->assertEqualsWithDelta(5.00, $pricing->cost('claude-opus-5', 1_000_000, 0, 0, 0, 0), 0.000001);
        $this->assertEqualsWithDelta(2.00, $pricing->cost('claude-sonnet-5-5-20261001', 1_000_000, 0, 0, 0, 0), 0.000001);
    }

    public function testAnUnknownModelIsCountedAtOpusRates(): void
    {
        $pricing = new AssistantPricing();

        $this->assertFalse($pricing->isKnown('claude-nouveau-9'));
        $this->assertEqualsWithDelta(25.00, $pricing->cost('claude-nouveau-9', 0, 0, 0, 0, 1_000_000), 0.000001);
    }

    public function testHaikuCostsMoreOnLongPrompts(): void
    {
        $pricing = new AssistantPricing();

        $this->assertEqualsWithDelta(0.01, $pricing->cost('claude-haiku-5-5', 100_000, 0, 0, 0, 0), 0.000001);
        $this->assertEqualsWithDelta(0.10, $pricing->cost('claude-haiku-5-5', 200_000, 0, 0, 0, 0), 0.000001);
    }
}
