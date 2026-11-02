<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Wallet;

use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Exceptions\WalletPassFailedException;
use HiEvents\Exceptions\WalletPassUnavailableException;
use HiEvents\Services\Domain\Wallet\WalletPassDataService;
use HiEvents\Services\Infrastructure\Wallet\ApplePassBuilder;
use HiEvents\Services\Infrastructure\Wallet\DTO\WalletFileDTO;
use HiEvents\Services\Infrastructure\Wallet\WalletConfig;
use Illuminate\Support\Traits\Localizable;

class GetAppleWalletPassPublicHandler
{
    use Localizable;

    public function __construct(
        private readonly WalletConfig          $walletConfig,
        private readonly WalletPassDataService $walletPassDataService,
        private readonly ApplePassBuilder      $applePassBuilder,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     * @throws WalletPassUnavailableException
     * @throws WalletPassFailedException
     */
    public function handle(int $eventId, string $orderShortId): WalletFileDTO
    {
        if (!$this->walletConfig->isAppleEnabled()) {
            throw new WalletPassUnavailableException(__('Apple Wallet is not available.'));
        }

        $order = $this->walletPassDataService->forOrder($eventId, $orderShortId);

        return $this->withLocale($order->locale, fn() => $this->applePassBuilder->build($order));
    }
}
