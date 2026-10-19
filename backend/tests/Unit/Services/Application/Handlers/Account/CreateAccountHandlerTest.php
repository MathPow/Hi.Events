<?php

namespace Tests\Unit\Services\Application\Handlers\Account;

use HiEvents\DomainObjects\AccountConfigurationDomainObject;
use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\AccountRegistrationInviteDomainObject;
use HiEvents\DomainObjects\AccountUserDomainObject;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Repository\Interfaces\AccountAttributionRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountConfigurationRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\Account\CreateAccountHandler;
use HiEvents\Services\Application\Handlers\Account\DTO\CreateAccountDTO;
use HiEvents\Services\Application\Handlers\Account\Exceptions\AccountRegistrationDisabledException;
use HiEvents\Services\Domain\Account\AccountRegistrationInviteService;
use HiEvents\Services\Domain\Account\AccountUserAssociationService;
use HiEvents\Services\Domain\User\EmailConfirmationService;
use Illuminate\Cache\Repository as CacheRepository;
use Illuminate\Config\Repository;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Database\DatabaseManager;
use Illuminate\Hashing\HashManager;
use Mockery as m;
use Psr\Log\NullLogger;
use Tests\TestCase;

class CreateAccountHandlerTest extends TestCase
{
    private AccountRepositoryInterface $accountRepository;

    private CreateAccountHandler $handler;

    private AccountRegistrationInviteService $registrationInviteService;

    private Repository $config;

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

        $this->config = m::mock(Repository::class);
        $this->config->shouldReceive('get')->andReturnNull()->byDefault();

        $lock = m::mock(Lock::class);
        $lock->shouldReceive('block')->andReturnUsing(fn(int $seconds, callable $callback) => $callback());
        $cache = m::mock(CacheRepository::class);
        $cache->shouldReceive('lock')->with('public-signup', 10)->andReturn($lock);

        $configuration = m::mock(AccountConfigurationDomainObject::class);
        $configuration->shouldReceive('getId')->andReturn(1);
        $configurationRepository = m::mock(AccountConfigurationRepositoryInterface::class);
        $configurationRepository->shouldReceive('findFirstWhere')->andReturn($configuration);

        $user = m::mock(UserDomainObject::class);
        $user->shouldReceive('getId')->andReturn(1);
        $userRepository->shouldReceive('create')->andReturn($user)->byDefault();

        $accountUserRepository = m::mock(AccountUserRepositoryInterface::class);
        $accountUserRepository->shouldReceive('create')->andReturn(m::mock(AccountUserDomainObject::class));

        $this->registrationInviteService = m::mock(AccountRegistrationInviteService::class);

        $this->handler = new CreateAccountHandler(
            userRepository: $userRepository,
            accountRepository: $this->accountRepository,
            hashManager: $hashManager,
            databaseManager: $databaseManager,
            config: $this->config,
            emailConfirmationService: m::mock(EmailConfirmationService::class)->shouldIgnoreMissing(),
            accountUserAssociationService: new AccountUserAssociationService($accountUserRepository),
            accountUserRepository: $accountUserRepository,
            accountConfigurationRepository: $configurationRepository,
            accountAttributionRepository: m::mock(AccountAttributionRepositoryInterface::class),
            registrationInviteService: $this->registrationInviteService,
            cache: $cache,
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

    public function testPublicSignUpStartsOnTheUntrustedMessagingTier(): void
    {
        $this->expectAccountCreatedWith(fn(array $attributes) => $attributes['account_messaging_tier_id'] === 1);

        $this->handler->handle($this->dto(organizationName: 'Course en blanc'));
    }

    public function testInvitedSignUpKeepsThePremiumMessagingTier(): void
    {
        $invite = m::mock(AccountRegistrationInviteDomainObject::class);
        $this->registrationInviteService->shouldReceive('findUsableByToken')->with('invite-token')->andReturn($invite);
        $this->registrationInviteService->shouldReceive('assertUsableForEmail');
        $this->registrationInviteService->shouldReceive('consume')->once();

        $this->expectAccountCreatedWith(fn(array $attributes) => $attributes['account_messaging_tier_id'] === 3);

        $this->handler->handle($this->dto(organizationName: 'Course en blanc', registrationToken: 'invite-token'));
    }

    public function testPublicSignUpIsRefusedOnceTheLimitIsReached(): void
    {
        $this->config->shouldReceive('get')->with('app.public_signup_limit')->andReturn('25');
        $this->accountRepository->shouldReceive('countWhere')->with(['is_public_signup' => true])->andReturn(25);
        $this->accountRepository->shouldNotReceive('create');

        $this->expectException(AccountRegistrationDisabledException::class);

        $this->handler->handle($this->dto(organizationName: 'Course en blanc'));
    }

    public function testPublicSignUpBelowTheLimitIsCountedAsPublic(): void
    {
        $this->config->shouldReceive('get')->with('app.public_signup_limit')->andReturn('25');
        $this->accountRepository->shouldReceive('countWhere')->with(['is_public_signup' => true])->andReturn(24);

        $this->expectAccountCreatedWith(fn(array $attributes) => $attributes['is_public_signup'] === true);

        $this->handler->handle($this->dto(organizationName: 'Course en blanc'));
    }

    public function testInvitedSignUpIgnoresThePublicSignUpLimit(): void
    {
        $this->config->shouldReceive('get')->with('app.public_signup_limit')->andReturn('25');
        $this->accountRepository->shouldNotReceive('countWhere');

        $invite = m::mock(AccountRegistrationInviteDomainObject::class);
        $this->registrationInviteService->shouldReceive('findUsableByToken')->with('invite-token')->andReturn($invite);
        $this->registrationInviteService->shouldReceive('assertUsableForEmail');
        $this->registrationInviteService->shouldReceive('consume')->once();

        $this->expectAccountCreatedWith(fn(array $attributes) => $attributes['is_public_signup'] === false);

        $this->handler->handle($this->dto(organizationName: 'Course en blanc', registrationToken: 'invite-token'));
    }

    private function expectAccountCreatedWith(callable $matcher): void
    {
        $account = m::mock(AccountDomainObject::class);
        $account->shouldReceive('getId')->andReturn(1);

        $this->accountRepository->shouldReceive('create')
            ->once()
            ->withArgs($matcher)
            ->andReturn($account);
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

    private function dto(?string $organizationName, ?string $registrationToken = null): CreateAccountDTO
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
            registration_token: $registrationToken,
        );
    }
}
