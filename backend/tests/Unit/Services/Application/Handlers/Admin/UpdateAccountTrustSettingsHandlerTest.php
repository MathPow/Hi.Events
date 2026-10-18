<?php

namespace Tests\Unit\Services\Application\Handlers\Admin;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Services\Application\Handlers\Admin\DTO\UpdateAccountTrustSettingsDTO;
use HiEvents\Services\Application\Handlers\Admin\UpdateAccountTrustSettingsHandler;
use Mockery;
use Mockery\MockInterface;
use Psr\Log\NullLogger;
use Tests\TestCase;

class UpdateAccountTrustSettingsHandlerTest extends TestCase
{
    private MockInterface|AccountRepositoryInterface $accountRepository;

    private UpdateAccountTrustSettingsHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountRepository = Mockery::mock(AccountRepositoryInterface::class);
        $this->handler = new UpdateAccountTrustSettingsHandler($this->accountRepository, new NullLogger());
    }

    public function testOnlyTheGivenSettingsAreChanged(): void
    {
        $this->givenAccount(suspendedAt: null);

        $this->accountRepository->shouldReceive('updateFromArray')
            ->once()
            ->with(5, ['platform_payments_allowed' => true])
            ->andReturn(new AccountDomainObject());

        $this->handler->handle(new UpdateAccountTrustSettingsDTO(accountId: 5, platformPaymentsAllowed: true));
    }

    public function testSuspendingStampsTheDate(): void
    {
        $this->givenAccount(suspendedAt: null);

        $this->accountRepository->shouldReceive('updateFromArray')
            ->once()
            ->withArgs(fn(int $id, array $attributes) => $id === 5 && $attributes['suspended_at'] !== null)
            ->andReturn(new AccountDomainObject());

        $this->handler->handle(new UpdateAccountTrustSettingsDTO(accountId: 5, suspended: true));
    }

    public function testSuspendingAnAlreadySuspendedAccountKeepsTheOriginalDate(): void
    {
        $this->givenAccount(suspendedAt: '2026-10-01 10:00:00');

        $this->accountRepository->shouldNotReceive('updateFromArray');

        $this->handler->handle(new UpdateAccountTrustSettingsDTO(accountId: 5, suspended: true));
    }

    public function testLiftingASuspensionClearsTheDate(): void
    {
        $this->givenAccount(suspendedAt: '2026-10-01 10:00:00');

        $this->accountRepository->shouldReceive('updateFromArray')
            ->once()
            ->with(5, ['donation_receipts_allowed' => false, 'suspended_at' => null])
            ->andReturn(new AccountDomainObject());

        $this->handler->handle(new UpdateAccountTrustSettingsDTO(
            accountId: 5,
            donationReceiptsAllowed: false,
            suspended: false,
        ));
    }

    private function givenAccount(?string $suspendedAt): void
    {
        $account = (new AccountDomainObject())->setId(5)->setSuspendedAt($suspendedAt);

        $this->accountRepository->shouldReceive('findById')->with(5)->andReturn($account);
    }
}
