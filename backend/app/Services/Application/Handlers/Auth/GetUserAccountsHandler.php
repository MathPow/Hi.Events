<?php

namespace HiEvents\Services\Application\Handlers\Auth;

use HiEvents\Services\Domain\Auth\AccountSwitchService;
use HiEvents\Services\Domain\Auth\DTO\UserAccountDTO;
use Illuminate\Support\Collection;

class GetUserAccountsHandler
{
    public function __construct(
        private readonly AccountSwitchService $accountSwitchService,
    )
    {
    }

    /**
     * @return Collection<int, UserAccountDTO>
     */
    public function handle(int $userId, int $currentAccountId): Collection
    {
        return $this->accountSwitchService->getAccounts($userId, $currentAccountId);
    }
}
