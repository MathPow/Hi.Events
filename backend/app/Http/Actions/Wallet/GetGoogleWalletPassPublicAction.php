<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Wallet;

use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Exceptions\WalletPassFailedException;
use HiEvents\Exceptions\WalletPassUnavailableException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Services\Application\Handlers\Wallet\GetGoogleWalletPassPublicHandler;
use Illuminate\Http\JsonResponse;
use Psr\Log\LoggerInterface;

/** The link that adds the order's tickets to Google Wallet. */
class GetGoogleWalletPassPublicAction extends BaseAction
{
    public function __construct(
        private readonly GetGoogleWalletPassPublicHandler $handler,
        private readonly LoggerInterface                  $logger,
    )
    {
    }

    public function __invoke(int $eventId, string $orderShortId): JsonResponse
    {
        try {
            $saveUrl = $this->handler->handle($eventId, $orderShortId);
        } catch (ResourceNotFoundException|WalletPassUnavailableException $exception) {
            return $this->errorResponse($exception->getMessage(), ResponseCodes::HTTP_NOT_FOUND);
        } catch (WalletPassFailedException $exception) {
            $this->logger->error($exception->getMessage(), ['event_id' => $eventId, 'order_short_id' => $orderShortId]);

            return $this->errorResponse(
                __('Your tickets could not be added to the wallet. Please try again later.'),
                ResponseCodes::HTTP_SERVICE_UNAVAILABLE,
            );
        }

        return $this->jsonResponse(['save_url' => $saveUrl]);
    }
}
