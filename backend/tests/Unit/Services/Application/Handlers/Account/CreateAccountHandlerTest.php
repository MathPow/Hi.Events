<?php

namespace Tests\Unit\Services\Application\Handlers\Account;

use HiEvents\DomainObjects\AccountConfigurationDomainObject;
use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\AccountUserDomainObject;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Repository\Interfaces\AccountAttributionRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountConfigurationRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\Account\CreateAccountHandler;
use HiEvents\Services\Application\Handlers\Account\DTO\CreateAccountDTO;
use HiEvents\Services\Domain\Account\AccountRegistrationInviteService;
use HiEvents\Services\Domain\Account\AccountUserAssociationService;
use HiEvents\Services\Domain\User\EmailConfirmationService;
use Illuminate\Config\Repository;
use Illuminate\Database\DatabaseManager;
use Illuminate\Hashing\HashManager;
use Mockery as m;
use Psr\Log\NullLogger;
use Tests\TestCase;

class CreateAccountHandlerTest extends TestCase
{
    private AccountRepositoryInterface $accountRepository;

    private CreateAccountHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountRepository = m::mock(AccountRepositoryInterface::class);

        $userRepository = m::mock(UserRepositoryInterface::class);
        $userRepository->shouldReceive('findFirstWhere')->andReturnNull();

        $hashManager = m::mock(HashManager::class);
        $hashManager->shouldReceive('make')->andReturn('hash');

        $databaseManager = m::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(fn(callable $callback) => $callback());

        $config = m::mock(Repository::class);
        $config->shouldReceive('get')->andReturnNull();

        $configuration = m::mock(AccountConfigurationDomainObject::class);
        $configuration->shouldReceive('getId')->andReturn(1);
        $configurationRepository = m::mock(AccountConfigurationRepositoryInterface::class);
        $configurationRepository->shouldReceive('findFirstWhere')->andReturn($configuration);

        $user = m::mock(UserDomainObject::class);
        $user->shouldReceive('getId')->andReturn(1);
        $userRepository->shouldReceive('create')->andReturn($user)->byDefault();

        $accountUserRepository = m::mock(AccountUserRepositoryInterface::class);
        $accountUserRepository->shouldReceive('create')->andReturn(m::mock(AccountUserDomainObject::class));

        $this->handler = new CreateAccountHandler(
            userRepository: $userRepository,
            accountRepository: $this->accountRepository,
            hashManager: $hashManager,
            databaseManager: $databaseManager,
            config: $config,
            emailConfirmationService: m::mock(EmailConfirmationService::class)->shouldIgnoreMissing(),
            accountUserAssociationService: new AccountUserAssociationService($accountUserRepository),
            accountUserRepository: $accountUserRepository,
            accountConfigurationRepository: $configurationRepository,
            accountAttributionRepository: m::mock(AccountAttributionRepositoryInterface::class),
            registrationInviteService: m::mock(AccountRegistrationInviteService::class),
            logger: new NullLogger(),
        );
    }

    public function testAccountIsNamedAfterTheOrganization(): void
    {
        $this->expectAccountNamed('Course en blanc');

        $this->handler->handle($this->dto(organizationName: '  Course en blanc '));
    }

    public function testAccountFallsBackToPersonNameWithoutOrganization(): void
    {
        $this->expectAccountNamed('Jane Doe');

        $this->handler->handle($this->dto(organizationName: '   '));
    }

    private function expectAccountNamed(string $name): void
    {
        $account = m::mock(AccountDomainObject::class);
        $account->shouldReceive('getId')->andReturn(1);

        $this->accountRepository->shouldReceive('create')
            ->once()
            ->withArgs(fn(array $attributes) => $attributes['name'] === $name)
            ->andReturn($account);
    }

    private function dto(?string $organizationName): CreateAccountDTO
    {
        return new CreateAccountDTO(
            email: 'jane@example.com',
            password: 'password123',
            first_name: 'Jane',
            locale: 'fr',
            last_name: 'Doe',
            timezone: 'America/Toronto',
            currency_code: 'CAD',
            organization_name: $organizationName,
        );
    }
}
