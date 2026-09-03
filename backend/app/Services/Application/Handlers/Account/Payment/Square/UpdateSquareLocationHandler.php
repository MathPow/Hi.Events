<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Account\Payment\Square;

use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Services\Domain\Payment\Square\DTO\SquareConnectionDTO;
use HiEvents\Services\Domain\Payment\Square\SquareConnectionService;

class UpdateSquareLocationHandler
{
    public function __construct(
        private readonly SquareConnectionService $connectionService,
    )
    {
    }

    /**
     * @throws SquareNotConnectedException|SquareOAuthException
     */
    public function handle(int $accountId, string $locationId): SquareConnectionDTO
    {
        $credential = $this->connectionService->findCredential($accountId);

        if ($credential === null) {
            throw new SquareNotConnectedException(
                __('This account is not connected to Square.')
            );
        }

        $this->connectionService->selectLocation($credential, $locationId);

        return $this->connectionService->getConnection($accountId);
    }
}
