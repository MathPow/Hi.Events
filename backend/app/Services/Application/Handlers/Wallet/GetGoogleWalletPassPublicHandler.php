<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Wallet;

use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Exceptions\WalletPassFailedException;
use HiEvents\Exceptions\WalletPassUnavailableException;
use HiEvents\Services\Domain\Wallet\WalletPassDataService;
use HiEvents\Services\Infrastructure\Wallet\GoogleWalletService;
use HiEvents\Services\Infrastructure\Wallet\WalletConfig;
use Illuminate\Support\Traits\Localizable;

class GetGoogleWalletPassPublicHandler
{
    use Localizable;

    public function __construct(
        private readonly WalletConfig          $walletConfig,
        private readonly WalletPassDataService $walletPassDataService,
        private readonly GoogleWalletService   $googleWalletService,
    )
    {
    }

    /**
     * The link that adds the order's tickets to Google Wallet.
     *
     * @throws ResourceNotFoundException
     * @throws WalletPassUnavailableException
     * @throws WalletPassFailedException
     */
    public function handle(int $eventId, string $orderShortId): string
    {
        if (!$this->walletConfig->isGoogleEnabled()) {
            throw new WalletPassUnavailableException(__('Google Wallet is not available.'));
        }

        $order = $this->walletPassDataService->forOrder($eventId, $orderShortId);

        return $this->withLocale($order->locale, fn() => $this->googleWalletService->saveUrl($order));
    }
}
