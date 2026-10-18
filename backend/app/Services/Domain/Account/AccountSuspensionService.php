<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Account;

use HiEvents\Repository\Interfaces\AccountRepositoryInterface;

/**
 * Un compte suspendu par un superadmin ne se connecte plus, et ses evenements
 * comme ses pages d'organisateur disparaissent du public. Rien n'est efface:
 * lever la suspension remet tout en place.
 */
class AccountSuspensionService
{
    public function __construct(
        private readonly AccountRepositoryInterface $accountRepository,
    )
    {
    }

    public function isSuspended(int $accountId): bool
    {
        return $this->accountRepository->findById($accountId)->isSuspended();
    }
}
