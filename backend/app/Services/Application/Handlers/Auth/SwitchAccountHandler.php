<?php

namespace HiEvents\Services\Application\Handlers\Auth;

use HiEvents\Exceptions\UnauthorizedException;
use HiEvents\Services\Application\Handlers\Auth\DTO\SwitchAccountDTO;
use HiEvents\Services\Domain\Auth\AccountSwitchService;

class SwitchAccountHandler
{
    public function __construct(
        private readonly AccountSwitchService $accountSwitchService,
    )
    {
    }

    /**
     * @throws UnauthorizedException
     */
    public function handle(SwitchAccountDTO $dto): string
    {
        return $this->accountSwitchService->switchTo($dto->userId, $dto->accountId, $dto->isImpersonating);
    }
}
