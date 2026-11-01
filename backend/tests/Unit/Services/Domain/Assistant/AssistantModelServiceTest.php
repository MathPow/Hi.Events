<?php

namespace Tests\Unit\Services\Domain\Assistant;

use HiEvents\Repository\Interfaces\PlatformSettingRepositoryInterface;
use HiEvents\Services\Domain\Assistant\AssistantModelService;
use HiEvents\Services\Domain\Assistant\AssistantPricing;
use HiEvents\Services\Domain\Assistant\UnknownAssistantModelException;
use Illuminate\Config\Repository;
use Mockery;
use Tests\TestCase;

class AssistantModelServiceTest extends TestCase
{
    private function service(?string $stored, string $configured = 'claude-sonnet-5-5', ?PlatformSettingRepositoryInterface $repository = null): AssistantModelService
    {
        if ($repository === null) {
            $repository = Mockery::mock(PlatformSettingRepositoryInterface::class);
            $repository->shouldReceive('getValue')->with(AssistantModelService::SETTING)->andReturn($stored);
        }

        return new AssistantModelService(
            $repository,
            new Repository(['services' => ['anthropic' => ['assistant_model' => $configured]]]),
            new AssistantPricing(),
        );
    }

    public function testTheChosenModelWins(): void
    {
        $this->assertSame('claude-haiku-5-5', $this->service('claude-haiku-5-5')->current());
    }

    public function testWithoutAChoiceTheServerConfigurationApplies(): void
    {
        $this->assertSame('claude-opus-5-5', $this->service(null, 'claude-opus-5-5')->current());
    }

    public function testAStoredModelThatIsNoLongerOfferedIsIgnored(): void
    {
        $this->assertSame('claude-sonnet-5-5', $this->service('claude-ancien-1')->current());
    }

    public function testOnlyOfferedModelsCanBeChosen(): void
    {
        $repository = Mockery::mock(PlatformSettingRepositoryInterface::class);
        $repository->shouldNotReceive('setValue');

        $this->expectException(UnknownAssistantModelException::class);
        $this->service(null, repository: $repository)->choose('gpt-5');
    }

    public function testChoosingNothingGoesBackToTheServerConfiguration(): void
    {
        $repository = Mockery::mock(PlatformSettingRepositoryInterface::class);
        $repository->shouldReceive('setValue')->once()->with(AssistantModelService::SETTING, null);

        $this->service(null, repository: $repository)->choose(null);
    }

    public function testHaikuHasNoServerSideFallback(): void
    {
        $service = $this->service(null);

        $this->assertFalse($service->supportsFallback('claude-haiku-5-5'));
        $this->assertTrue($service->supportsFallback('claude-sonnet-5-5'));
    }

    public function testOptionsCarryTheirPrices(): void
    {
        $options = collect($this->service(null)->options())->keyBy('id');

        $this->assertSame(0.10, $options['claude-haiku-5-5']['input']);
        $this->assertSame(10.00, $options['claude-sonnet-5-5']['output']);
    }
}
