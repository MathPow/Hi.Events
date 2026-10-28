<?php

namespace HiEvents\Services\Application\Handlers\Account;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Services\Application\Handlers\Account\DTO\UpdateAccountEventTypesDTO;

class UpdateAccountEventTypesHandler
{
    public function __construct(
        private readonly AccountRepositoryInterface $accountRepository,
    )
    {
    }

    public function handle(UpdateAccountEventTypesDTO $data): AccountDomainObject
    {
        $this->accountRepository->updateWhere(
            attributes: [
                'event_types' => array_values(array_unique($data->eventTypes)),
            ],
            where: [
                'id' => $data->accountId,
            ],
        );

        return $this->accountRepository->findById($data->accountId);
    }
}
