<?php

namespace Tests\Unit\Services\Application\Handlers\Account;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Services\Application\Handlers\Account\DTO\UpdateAccountEventTypesDTO;
use HiEvents\Services\Application\Handlers\Account\UpdateAccountEventTypesHandler;
use Mockery as m;
use Tests\TestCase;

class UpdateAccountEventTypesHandlerTest extends TestCase
{
    private AccountRepositoryInterface $accountRepository;

    private UpdateAccountEventTypesHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountRepository = m::mock(AccountRepositoryInterface::class);
        $this->handler = new UpdateAccountEventTypesHandler($this->accountRepository);
    }

    public function testStoresEachEventTypeOnceOnTheAccount(): void
    {
        $account = new AccountDomainObject();

        $this->accountRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(['event_types' => ['SPORT', 'SOCIAL']], ['id' => 12]);

        $this->accountRepository
            ->shouldReceive('findById')
            ->once()
            ->with(12)
            ->andReturn($account);

        $result = $this->handler->handle(new UpdateAccountEventTypesDTO(
            accountId: 12,
            eventTypes: ['SPORT', 'SOCIAL', 'SPORT'],
        ));

        $this->assertSame($account, $result);
    }

    public function testAnEmptyChoiceClearsTheEventTypes(): void
    {
        $this->accountRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(['event_types' => []], ['id' => 12]);

        $this->accountRepository
            ->shouldReceive('findById')
            ->once()
            ->andReturn(new AccountDomainObject());

        $this->handler->handle(new UpdateAccountEventTypesDTO(accountId: 12, eventTypes: []));
    }
}
