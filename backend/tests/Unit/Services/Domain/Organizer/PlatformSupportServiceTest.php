<?php

namespace Tests\Unit\Services\Domain\Organizer;

use HiEvents\DomainObjects\AccountConfigurationDomainObject;
use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Services\Domain\Organizer\PlatformSupportService;
use Mockery as m;
use Tests\TestCase;

class PlatformSupportServiceTest extends TestCase
{
    private AccountRepositoryInterface $accountRepository;
    private PlatformSupportService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountRepository = m::mock(AccountRepositoryInterface::class);
        $this->accountRepository->shouldReceive('loadRelation')->andReturnSelf();

        $this->service = new PlatformSupportService($this->accountRepository);
    }

    public function testAlwaysOnUpToTheFeeThresholdIncluded(): void
    {
        $this->givenAccountFee(1.5);

        $this->assertTrue($this->service->isAlwaysOn(3));
    }

    public function testNotAlwaysOnAboveTheFeeThreshold(): void
    {
        $this->givenAccountFee(2.0);

        $this->assertFalse($this->service->isAlwaysOn(3));
    }

    public function testNotAlwaysOnWithoutAnAccountConfiguration(): void
    {
        $this->accountRepository->shouldReceive('findFirst')->with(3)->andReturn(new AccountDomainObject());

        $this->assertFalse($this->service->isAlwaysOn(3));
    }

    public function testEnabledByTheOrganizerWithoutCheckingTheFee(): void
    {
        $this->accountRepository->shouldNotReceive('findFirst');

        $this->assertTrue($this->service->isEnabled(3, $this->settings(true)));
        $this->assertTrue($this->service->isEnabled(3, null));
    }

    public function testTurnedOffByTheOrganizerStaysOnWhenTheFeeIsLowEnough(): void
    {
        $this->givenAccountFee(0.0);

        $this->assertTrue($this->service->isEnabled(3, $this->settings(false)));
    }

    public function testTurnedOffByTheOrganizerAboveTheFeeThreshold(): void
    {
        $this->givenAccountFee(3.0);

        $this->assertFalse($this->service->isEnabled(3, $this->settings(false)));
    }

    private function givenAccountFee(float $percentage): void
    {
        $configuration = new AccountConfigurationDomainObject();
        $configuration->setApplicationFees(['percentage' => $percentage, 'fixed' => 0]);
        $account = new AccountDomainObject();
        $account->setConfiguration($configuration);

        $this->accountRepository->shouldReceive('findFirst')->with(3)->andReturn($account);
    }

    private function settings(bool $platformSupportEnabled): OrganizerSettingDomainObject
    {
        return (new OrganizerSettingDomainObject())->setPlatformSupportEnabled($platformSupportEnabled);
    }
}
