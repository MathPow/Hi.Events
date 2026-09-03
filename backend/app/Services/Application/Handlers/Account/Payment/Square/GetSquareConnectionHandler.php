<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Account\Payment\Square;

use HiEvents\Exceptions\Square\SquareOAuthException;
use HiEvents\Services\Domain\Payment\Square\DTO\SquareConnectionDTO;
use HiEvents\Services\Domain\Payment\Square\SquareConnectionService;

class GetSquareConnectionHandler
{
    public function __construct(
        private readonly SquareConnectionService $connectionService,
    )
    {
    }

    /**
     * @throws SquareOAuthException
     */
    public function handle(int $accountId): SquareConnectionDTO
    {
        return $this->connectionService->getConnection($accountId);
    }
}
