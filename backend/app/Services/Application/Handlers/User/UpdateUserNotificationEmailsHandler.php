<?php

namespace HiEvents\Services\Application\Handlers\User;

use HiEvents\DomainObjects\Generated\AccountUserDomainObjectAbstract;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\User\DTO\UpdateUserNotificationEmailsDTO;

class UpdateUserNotificationEmailsHandler
{
    public function __construct(
        private readonly AccountUserRepositoryInterface $accountUserRepository,
        private readonly UserRepositoryInterface        $userRepository,
    )
    {
    }

    public function handle(UpdateUserNotificationEmailsDTO $dto): UserDomainObject
    {
        $user = $this->userRepository->findByIdAndAccountId($dto->user_id, $dto->account_id);

        $attributes = array_filter([
            AccountUserDomainObjectAbstract::RECEIVES_ORGANIZER_MESSAGES => $dto->organizer_messages,
            AccountUserDomainObjectAbstract::RECEIVES_ORDER_NOTIFICATIONS => $dto->new_orders,
        ], fn(?bool $value) => $value !== null);

        if ($attributes === []) {
            return $user;
        }

        $this->accountUserRepository->updateWhere(
            attributes: $attributes,
            where: [
                AccountUserDomainObjectAbstract::USER_ID => $user->getId(),
                AccountUserDomainObjectAbstract::ACCOUNT_ID => $dto->account_id,
            ],
        );

        return $this->userRepository->findByIdAndAccountId($dto->user_id, $dto->account_id);
    }
}
