<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Admin;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\Generated\AccountDomainObjectAbstract;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Services\Application\Handlers\Admin\DTO\UpdateAccountTrustSettingsDTO;
use Psr\Log\LoggerInterface;

/**
 * Ce qu'un superadmin accorde ou retire a un compte: encaisser sur le compte
 * Stripe de la plateforme, emettre des recus officiels, et la suspension.
 * Un champ absent du DTO n'est pas touche.
 */
class UpdateAccountTrustSettingsHandler
{
    public function __construct(
        private readonly AccountRepositoryInterface $accountRepository,
        private readonly LoggerInterface            $logger,
    )
    {
    }

    public function handle(UpdateAccountTrustSettingsDTO $dto): AccountDomainObject
    {
        $account = $this->accountRepository->findById($dto->accountId);

        $attributes = [];

        if ($dto->platformPaymentsAllowed !== null) {
            $attributes[AccountDomainObjectAbstract::PLATFORM_PAYMENTS_ALLOWED] = $dto->platformPaymentsAllowed;
        }

        if ($dto->donationReceiptsAllowed !== null) {
            $attributes[AccountDomainObjectAbstract::DONATION_RECEIPTS_ALLOWED] = $dto->donationReceiptsAllowed;
        }

        // On garde la date de la premiere suspension tant qu'elle dure.
        if ($dto->suspended !== null && $dto->suspended !== $account->isSuspended()) {
            $attributes[AccountDomainObjectAbstract::SUSPENDED_AT] = $dto->suspended ? now()->toDateTimeString() : null;
        }

        if ($attributes === []) {
            return $account;
        }

        $this->logger->info('Account trust settings updated', [
            'accountId' => $dto->accountId,
            'changes' => $attributes,
        ]);

        return $this->accountRepository->updateFromArray($dto->accountId, $attributes);
    }
}
