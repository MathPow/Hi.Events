<?php

namespace Tests\Unit\Services\Domain\Account;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\AccountMessagingTierDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\EmailSendingLimitExceededException;
use HiEvents\Repository\Interfaces\AccountMessagingTierRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\Account\OrganizerEmailQuotaService;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\RateLimiter;
use Illuminate\Cache\Repository as CacheRepository;
use Illuminate\Config\Repository;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class OrganizerEmailQuotaServiceTest extends TestCase
{
    private MockInterface|AccountRepositoryInterface $accountRepository;

    private MockInterface|EventRepositoryInterface $eventRepository;

    private MockInterface|AccountMessagingTierRepositoryInterface $tierRepository;

    private OrganizerEmailQuotaService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountRepository = Mockery::mock(AccountRepositoryInterface::class);
        $this->eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $this->tierRepository = Mockery::mock(AccountMessagingTierRepositoryInterface::class);

        $this->service = new OrganizerEmailQuotaService(
            accountRepository: $this->accountRepository,
            eventRepository: $this->eventRepository,
            messagingTierRepository: $this->tierRepository,
            rateLimiter: new RateLimiter(new CacheRepository(new ArrayStore())),
            config: new Repository(['app' => ['untrusted_account_daily_email_limit' => 2]]),
        );
    }

    public function testAnUntrustedAccountIsCappedForTheDay(): void
    {
        $this->givenAccountOnTier(accountId: 7, tierName: 'Untrusted');

        $this->service->consumeForAccount(7);
        $this->service->consumeForAccount(7);

        $this->expectException(EmailSendingLimitExceededException::class);

        $this->service->consumeForAccount(7);
    }

    public function testTryConsumeReportsTheCapInsteadOfThrowing(): void
    {
        $this->givenAccountOnTier(accountId: 7, tierName: 'Untrusted');

        $this->assertTrue($this->service->tryConsumeForAccount(7));
        $this->assertTrue($this->service->tryConsumeForAccount(7));
        $this->assertFalse($this->service->tryConsumeForAccount(7));
    }

    public function testTrustedAndPremiumAccountsAreNotCapped(): void
    {
        $this->givenAccountOnTier(accountId: 8, tierName: 'Premium');

        for ($i = 0; $i < 5; $i++) {
            $this->assertTrue($this->service->tryConsumeForAccount(8));
        }
    }

    public function testEachAccountHasItsOwnCap(): void
    {
        $this->givenAccountOnTier(accountId: 7, tierName: 'Untrusted');
        $this->givenAccountOnTier(accountId: 9, tierName: 'Untrusted');

        $this->service->consumeForAccount(7);
        $this->service->consumeForAccount(7);

        $this->assertTrue($this->service->tryConsumeForAccount(9));
    }

    public function testAnEventCountsAgainstItsAccount(): void
    {
        $this->givenAccountOnTier(accountId: 7, tierName: 'Untrusted');

        $event = Mockery::mock(EventDomainObject::class);
        $event->shouldReceive('getAccountId')->andReturn(7);
        $this->eventRepository->shouldReceive('findById')->with(42)->andReturn($event);

        $this->service->consumeForAccount(7);
        $this->service->consumeForEvent(42);

        $this->assertFalse($this->service->tryConsumeForEvent(42));
    }

    private function givenAccountOnTier(int $accountId, string $tierName): void
    {
        $tierId = $accountId * 10;

        $account = Mockery::mock(AccountDomainObject::class);
        $account->shouldReceive('getAccountMessagingTierId')->andReturn($tierId);
        $this->accountRepository->shouldReceive('findById')->with($accountId)->andReturn($account);

        $tier = Mockery::mock(AccountMessagingTierDomainObject::class);
        $tier->shouldReceive('getName')->andReturn($tierName);
        $this->tierRepository->shouldReceive('findFirst')->with($tierId)->andReturn($tier);
    }
}
