<?php

namespace Tests\Unit\Services\Domain\Auth;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\AccountUserDomainObject;
use HiEvents\DomainObjects\Status\UserStatus;
use HiEvents\Exceptions\UnauthorizedException;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Services\Domain\Auth\AccountSwitchService;
use Illuminate\Auth\AuthManager;
use Illuminate\Contracts\Auth\Authenticatable;
use Mockery as m;
use Tests\TestCase;

class AccountSwitchServiceTest extends TestCase
{
    private AccountUserRepositoryInterface $accountUserRepository;
    private AuthManager $authManager;
    private AccountSwitchService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->accountUserRepository = m::mock(AccountUserRepositoryInterface::class);
        $this->accountUserRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->authManager = m::mock(AuthManager::class);

        $this->service = new AccountSwitchService($this->accountUserRepository, $this->authManager);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    private function membership(int $accountId, string $name, string $status = 'ACTIVE', string $role = 'ADMIN', bool $suspended = false): AccountUserDomainObject
    {
        $account = (new AccountDomainObject())
            ->setId($accountId)
            ->setName($name)
            ->setSuspendedAt($suspended ? '2026-10-01 12:00:00' : null);

        return (new AccountUserDomainObject())
            ->setId($accountId * 10)
            ->setUserId(7)
            ->setAccountId($accountId)
            ->setRole($role)
            ->setStatus($status)
            ->setAccount($account);
    }

    private function givenMemberships(AccountUserDomainObject ...$memberships): void
    {
        $this->accountUserRepository->shouldReceive('findWhere')->with(['user_id' => 7])->andReturn(collect($memberships));
    }

    private function signedInAs(int $userId): Authenticatable
    {
        $user = m::mock(Authenticatable::class);
        $user->shouldReceive('getAuthIdentifier')->andReturn($userId);
        $this->authManager->shouldReceive('user')->andReturn($user);

        return $user;
    }

    public function testTheAccountsListOnlyThoseThePersonCanOpenByName(): void
    {
        $this->givenMemberships(
            $this->membership(1, 'Sulpace'),
            $this->membership(2, 'club de vélo'),
            $this->membership(3, 'Invitation pending', status: UserStatus::INVITED->name),
            $this->membership(4, 'Suspended', suspended: true),
        );

        $accounts = $this->service->getAccounts(7, 1);

        $this->assertSame(['club de vélo', 'Sulpace'], $accounts->pluck('name')->all());
        $this->assertSame([false, true], $accounts->pluck('is_current')->all());
    }

    public function testSwitchingGivesASessionForTheOtherAccountWithTheRoleThere(): void
    {
        $this->givenMemberships($this->membership(1, 'Dehors'), $this->membership(2, 'Sulpace', role: 'ORGANIZER'));
        $user = $this->signedInAs(7);

        $guard = m::mock();
        $this->authManager->shouldReceive('claims')->once()
            ->with(['account_id' => 2, 'role' => 'ORGANIZER'])
            ->andReturn($guard);
        $guard->shouldReceive('login')->once()->with($user)->andReturn('new-token');
        $this->accountUserRepository->shouldReceive('updateWhere')->once()
            ->withArgs(fn(array $attributes, array $where) => isset($attributes['last_login_at'])
                && $where === ['user_id' => 7, 'account_id' => 2]);

        $this->assertSame('new-token', $this->service->switchTo(7, 2, isImpersonating: false));
    }

    public function testAnAccountThePersonDoesNotBelongToIsRefused(): void
    {
        $this->givenMemberships($this->membership(1, 'Dehors'));
        $this->authManager->shouldNotReceive('claims');

        $this->expectException(UnauthorizedException::class);

        $this->service->switchTo(7, 99, isImpersonating: false);
    }

    public function testAnInvitationNotYetAcceptedIsRefused(): void
    {
        $this->givenMemberships($this->membership(2, 'Sulpace', status: UserStatus::INVITED->name));
        $this->authManager->shouldNotReceive('claims');

        $this->expectException(UnauthorizedException::class);

        $this->service->switchTo(7, 2, isImpersonating: false);
    }

    public function testASuspendedAccountIsRefused(): void
    {
        $this->givenMemberships($this->membership(2, 'Sulpace', suspended: true));
        $this->authManager->shouldNotReceive('claims');

        $this->expectException(UnauthorizedException::class);

        $this->service->switchTo(7, 2, isImpersonating: false);
    }

    public function testNoSwitchingWhileImpersonating(): void
    {
        $this->accountUserRepository->shouldNotReceive('findWhere');
        $this->authManager->shouldNotReceive('claims');

        $this->expectException(UnauthorizedException::class);

        $this->service->switchTo(7, 2, isImpersonating: true);
    }
}
