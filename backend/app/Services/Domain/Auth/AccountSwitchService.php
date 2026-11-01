<?php

namespace HiEvents\Services\Domain\Auth;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\AccountUserDomainObject;
use HiEvents\DomainObjects\Status\UserStatus;
use HiEvents\Exceptions\UnauthorizedException;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Services\Domain\Auth\DTO\UserAccountDTO;
use Illuminate\Auth\AuthManager;
use Illuminate\Support\Collection;

/**
 * The accounts a person belongs to, and going from one to another without signing in again: a new
 * session for the other account, with their role there, as the login gives.
 */
class AccountSwitchService
{
    public function __construct(
        private readonly AccountUserRepositoryInterface $accountUserRepository,
        private readonly AuthManager                    $authManager,
    )
    {
    }

    /**
     * @return Collection<int, UserAccountDTO> the accounts the person can open, by name
     */
    public function getAccounts(int $userId, int $currentAccountId): Collection
    {
        return $this->memberships($userId)
            ->filter(fn(AccountUserDomainObject $membership) => $this->canOpen($membership))
            ->map(fn(AccountUserDomainObject $membership) => new UserAccountDTO(
                id: $membership->getAccountId(),
                name: $membership->getAccount()->getName(),
                is_current: $membership->getAccountId() === $currentAccountId,
            ))
            ->sortBy(fn(UserAccountDTO $account) => mb_strtolower($account->name))
            ->values();
    }

    /**
     * @return string the session token for the other account
     * @throws UnauthorizedException
     */
    public function switchTo(int $userId, int $accountId, bool $isImpersonating): string
    {
        if ($isImpersonating) {
            throw new UnauthorizedException(__('Accounts cannot be switched while impersonating a user'));
        }

        /** @var AccountUserDomainObject|null $membership */
        $membership = $this->memberships($userId)
            ->first(fn(AccountUserDomainObject $membership) => $membership->getAccountId() === $accountId);

        if ($membership === null || $membership->getAccount() === null) {
            throw new UnauthorizedException(__('Account not found'));
        }

        if ($membership->getStatus() !== UserStatus::ACTIVE->name) {
            throw new UnauthorizedException(__('User account is not active'));
        }

        if ($membership->getAccount()->isSuspended()) {
            throw new UnauthorizedException(__('This account has been suspended. Contact support for more information.'));
        }

        $user = $this->authManager->user();
        if ($user === null || (int)$user->getAuthIdentifier() !== $userId) {
            throw new UnauthorizedException(__('Account not found'));
        }

        $token = $this->authManager->claims([
            'account_id' => $accountId,
            'role' => $membership->getRole(),
        ])->login($user);

        $this->accountUserRepository->updateWhere(
            attributes: ['last_login_at' => now()],
            where: ['user_id' => $userId, 'account_id' => $accountId],
        );

        return $token;
    }

    /**
     * @return Collection<int, AccountUserDomainObject>
     */
    private function memberships(int $userId): Collection
    {
        return $this->accountUserRepository
            ->loadRelation(new Relationship(domainObject: AccountDomainObject::class, name: 'account'))
            ->findWhere(['user_id' => $userId]);
    }

    private function canOpen(AccountUserDomainObject $membership): bool
    {
        return $membership->getAccount() !== null
            && $membership->getStatus() === UserStatus::ACTIVE->name
            && !$membership->getAccount()->isSuspended();
    }
}
