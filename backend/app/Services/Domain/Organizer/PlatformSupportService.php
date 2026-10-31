<?php

namespace HiEvents\Services\Domain\Organizer;

use HiEvents\DomainObjects\AccountConfigurationDomainObject;
use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\OrganizerSettingDomainObject;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;

class PlatformSupportService
{
    public const ALWAYS_ON_UP_TO_FEE_PERCENT = 1.5;

    public function __construct(
        private readonly AccountRepositoryInterface $accountRepository,
    )
    {
    }

    public function isEnabled(int $accountId, ?OrganizerSettingDomainObject $settings): bool
    {
        return ($settings?->getPlatformSupportEnabled() ?? true) || $this->isAlwaysOn($accountId);
    }

    public function isAlwaysOn(int $accountId): bool
    {
        /** @var AccountDomainObject|null $account */
        $account = $this->accountRepository
            ->loadRelation(new Relationship(
                domainObject: AccountConfigurationDomainObject::class,
                name: 'configuration',
            ))
            ->findFirst($accountId);

        $configuration = $account?->getConfiguration();

        return $configuration !== null
            && $configuration->getPercentageApplicationFee() <= self::ALWAYS_ON_UP_TO_FEE_PERCENT;
    }
}
