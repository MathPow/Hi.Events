<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Account\Payment\Square;

use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Services\Domain\Payment\Square\SquareConnectionService;

class DisconnectSquareHandler
{
    public function __construct(
        private readonly SquareConnectionService $connectionService,
    )
    {
    }

    /**
     * @throws SquareNotConnectedException
     */
    public function handle(int $accountId): void
    {
        $credential = $this->connectionService->findCredential($accountId);

        if ($credential === null) {
            throw new SquareNotConnectedException(
                __('This account is not connected to Square.')
            );
        }

        $this->connectionService->disconnect($credential);
    }
}
