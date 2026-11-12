<?php

namespace HiEvents\Services\Application\Handlers\User;

use HiEvents\DomainObjects\Generated\AccountUserDomainObjectAbstract;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\User\DTO\UpdateUserMessageEmailsDTO;

class UpdateUserMessageEmailsHandler
{
    public function __construct(
        private readonly AccountUserRepositoryInterface $accountUserRepository,
        private readonly UserRepositoryInterface        $userRepository,
    )
    {
    }

    public function handle(UpdateUserMessageEmailsDTO $dto): UserDomainObject
    {
        $user = $this->userRepository->findByIdAndAccountId($dto->user_id, $dto->account_id);

        $this->accountUserRepository->updateWhere(
            attributes: [
                AccountUserDomainObjectAbstract::RECEIVES_ORGANIZER_MESSAGES => $dto->enabled,
            ],
            where: [
                AccountUserDomainObjectAbstract::USER_ID => $user->getId(),
                AccountUserDomainObjectAbstract::ACCOUNT_ID => $dto->account_id,
            ],
        );

        return $this->userRepository->findByIdAndAccountId($dto->user_id, $dto->account_id);
    }
}
