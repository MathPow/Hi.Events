<?php

namespace HiEvents\Http\Actions\Orders\Public;

use HiEvents\Exceptions\InvalidPromoCodeException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Order\ApplyPromoCodeToOrderRequest;
use HiEvents\Resources\Order\OrderResourcePublic;
use HiEvents\Services\Application\Handlers\Order\Public\ApplyPromoCodeToOrderHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Throwable;

class ApplyPromoCodeToOrderActionPublic extends BaseAction
{
    public function __construct(
        private readonly ApplyPromoCodeToOrderHandler $applyPromoCodeToOrderHandler,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function __invoke(ApplyPromoCodeToOrderRequest $request, int $eventId, string $orderShortId): JsonResponse
    {
        try {
            $order = $this->applyPromoCodeToOrderHandler->handle(
                eventId: $eventId,
                orderShortId: $orderShortId,
                promoCode: $request->validated('promo_code'),
            );
        } catch (InvalidPromoCodeException $exception) {
            throw ValidationException::withMessages([
                'promo_code' => $exception->getMessage(),
            ]);
        }

        return $this->resourceResponse(OrderResourcePublic::class, $order);
    }
}
