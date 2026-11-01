<?php

namespace Tests\Unit\Services\Domain\Assistant;

use Anthropic\Beta\Messages\BetaMessage;
use HiEvents\Repository\Interfaces\AssistantUsageRepositoryInterface;
use HiEvents\Services\Domain\Assistant\AssistantPricing;
use HiEvents\Services\Domain\Assistant\AssistantUsageService;
use Mockery;
use Psr\Log\NullLogger;
use RuntimeException;
use Tests\TestCase;

class AssistantUsageServiceTest extends TestCase
{
    private function message(array $usage, string $model = 'claude-sonnet-5-5'): BetaMessage
    {
        return BetaMessage::fromArray([
            'id' => 'msg_1',
            'type' => 'message',
            'role' => 'assistant',
            'model' => $model,
            'content' => [],
            'stop_reason' => 'end_turn',
            'stop_sequence' => null,
            'usage' => $usage,
        ]);
    }

    public function testRecordsTheTokensAndCostOfACall(): void
    {
        $repository = Mockery::mock(AssistantUsageRepositoryInterface::class);
        $repository->shouldReceive('create')->once()->with(Mockery::on(function (array $row) {
            $this->assertSame(7, $row['account_id']);
            $this->assertSame(3, $row['user_id']);
            $this->assertSame('claude-sonnet-5-5', $row['model']);
            $this->assertSame(1000, $row['input_tokens']);
            $this->assertSame(2000, $row['cache_creation_input_tokens']);
            $this->assertSame(10000, $row['cache_read_input_tokens']);
            $this->assertSame(500, $row['output_tokens']);
            // 1000 × 2 + 2000 × 2.5 + 10000 × 0.2 + 500 × 10, per million.
            $this->assertEqualsWithDelta(0.014, $row['cost_usd'], 0.0000001);
            $this->assertSame('end_turn', $row['stop_reason']);

            return true;
        }));

        $service = new AssistantUsageService($repository, new AssistantPricing(), new NullLogger());
        $service->record(7, 3, $this->message([
            'input_tokens' => 1000,
            'cache_creation_input_tokens' => 2000,
            'cache_read_input_tokens' => 10000,
            'output_tokens' => 500,
        ]), 'end_turn');
    }

    public function testEachFallbackAttemptIsPricedWithItsOwnModel(): void
    {
        $repository = Mockery::mock(AssistantUsageRepositoryInterface::class);
        $repository->shouldReceive('create')->once()->with(Mockery::on(function (array $row) {
            $this->assertSame('claude-sonnet-5', $row['model']);
            $this->assertSame(3000, $row['input_tokens']);
            $this->assertSame(400, $row['output_tokens']);
            // Sonnet 5.5: 1000 × 2 ; Sonnet 5: 2000 × 2 + 400 × 10.
            $this->assertEqualsWithDelta(0.010, $row['cost_usd'], 0.0000001);

            return true;
        }));

        $service = new AssistantUsageService($repository, new AssistantPricing(), new NullLogger());
        $service->record(7, null, $this->message([
            'input_tokens' => 2000,
            'output_tokens' => 400,
            'iterations' => [
                ['type' => 'message', 'model' => 'claude-sonnet-5-5', 'input_tokens' => 1000, 'output_tokens' => 0,
                    'cache_creation_input_tokens' => 0, 'cache_read_input_tokens' => 0],
                ['type' => 'fallback_message', 'model' => 'claude-sonnet-5', 'input_tokens' => 2000, 'output_tokens' => 400,
                    'cache_creation_input_tokens' => 0, 'cache_read_input_tokens' => 0],
            ],
        ], 'claude-sonnet-5'), 'end_turn');
    }

    public function testOneHourCacheWritesArePricedAsSuch(): void
    {
        $repository = Mockery::mock(AssistantUsageRepositoryInterface::class);
        $repository->shouldReceive('create')->once()->with(Mockery::on(function (array $row) {
            // 1000 × 2.5 (5 minutes) + 1000 × 4 (1 hour), per million.
            $this->assertEqualsWithDelta(0.0065, $row['cost_usd'], 0.0000001);

            return true;
        }));

        $service = new AssistantUsageService($repository, new AssistantPricing(), new NullLogger());
        $service->record(7, 3, $this->message([
            'input_tokens' => 0,
            'output_tokens' => 0,
            'cache_creation_input_tokens' => 2000,
            'cache_creation' => ['ephemeral_5m_input_tokens' => 1000, 'ephemeral_1h_input_tokens' => 1000],
        ]), 'end_turn');
    }

    public function testAFailedWriteDoesNotBreakTheAnswer(): void
    {
        $repository = Mockery::mock(AssistantUsageRepositoryInterface::class);
        $repository->shouldReceive('create')->once()->andThrow(new RuntimeException('database down'));

        $service = new AssistantUsageService($repository, new AssistantPricing(), new NullLogger());
        $service->record(7, 3, $this->message(['input_tokens' => 10, 'output_tokens' => 10]), 'end_turn');

        $this->addToAssertionCount(1);
    }
}
