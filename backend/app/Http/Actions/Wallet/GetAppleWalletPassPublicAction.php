<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Wallet;

use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Exceptions\WalletPassFailedException;
use HiEvents\Exceptions\WalletPassUnavailableException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Services\Application\Handlers\Wallet\GetAppleWalletPassPublicHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Psr\Log\LoggerInterface;

/** The order's tickets for Apple Wallet: Safari on iPhone opens them in the « Add » sheet. */
class GetAppleWalletPassPublicAction extends BaseAction
{
    public function __construct(
        private readonly GetAppleWalletPassPublicHandler $handler,
        private readonly LoggerInterface                 $logger,
    )
    {
    }

    public function __invoke(int $eventId, string $orderShortId): Response|JsonResponse
    {
        try {
            $file = $this->handler->handle($eventId, $orderShortId);
        } catch (ResourceNotFoundException|WalletPassUnavailableException $exception) {
            return $this->errorResponse($exception->getMessage(), ResponseCodes::HTTP_NOT_FOUND);
        } catch (WalletPassFailedException $exception) {
            $this->logger->error($exception->getMessage(), ['event_id' => $eventId, 'order_short_id' => $orderShortId]);

            return $this->errorResponse(
                __('Your tickets could not be added to the wallet. Please try again later.'),
                ResponseCodes::HTTP_SERVICE_UNAVAILABLE,
            );
        }

        return $this->fileResponse($file->content, $file->mimeType, $file->filename);
    }
}
