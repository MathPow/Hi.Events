<?php

namespace Tests\Unit\Services\Domain\Assistant;

use HiEvents\Services\Domain\Assistant\AssistantQuotaService;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\Repository as Cache;
use Illuminate\Config\Repository;
use Tests\TestCase;

class AssistantQuotaServiceTest extends TestCase
{
    private function service(int $limit): AssistantQuotaService
    {
        return new AssistantQuotaService(
            new Cache(new ArrayStore()),
            new Repository(['services' => ['anthropic' => ['assistant_daily_limit' => $limit]]]),
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
}
