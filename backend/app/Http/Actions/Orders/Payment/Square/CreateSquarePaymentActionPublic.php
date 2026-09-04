<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Orders\Payment\Square;

use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Exceptions\Square\CreateSquarePaymentFailedException;
use HiEvents\Exceptions\Square\SquareNotConnectedException;
use HiEvents\Exceptions\UnauthorizedException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Order\Square\CreateSquarePaymentRequest;
use HiEvents\Http\ResponseCodes;
use HiEvents\Resources\Order\OrderResourcePublic;
use HiEvents\Services\Application\Handlers\Order\Payment\Square\CreateSquarePaymentHandler;
use HiEvents\Services\Application\Handlers\Order\Payment\Square\DTO\CreateSquarePaymentDTO;
use Illuminate\Http\JsonResponse;
use Throwable;

class CreateSquarePaymentActionPublic extends BaseAction
{
    public function __construct(
        private readonly CreateSquarePaymentHandler $handler,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function __invoke(CreateSquarePaymentRequest $request, int $eventId, string $orderShortId): JsonResponse
    {
        try {
            $order = $this->handler->handle(new CreateSquarePaymentDTO(
                orderShortId: $orderShortId,
                sourceId: $request->validated('source_id'),
                verificationToken: $request->validated('verification_token'),
            ));
        } catch (UnauthorizedException $exception) {
            return $this->errorResponse($exception->getMessage(), ResponseCodes::HTTP_UNAUTHORIZED);
        } catch (ResourceConflictException $exception) {
            return $this->errorResponse($exception->getMessage(), ResponseCodes::HTTP_CONFLICT);
        } catch (SquareNotConnectedException|CreateSquarePaymentFailedException $exception) {
            return $this->errorResponse($exception->getMessage(), ResponseCodes::HTTP_UNPROCESSABLE_ENTITY);
        }

        return $this->resourceResponse(OrderResourcePublic::class, $order);
    }
}
