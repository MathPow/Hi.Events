<?php

namespace HiEvents\Http\Actions\Orders\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Order\SetOrderProductQuantityRequest;
use HiEvents\Resources\Order\OrderResourcePublic;
use HiEvents\Services\Application\Handlers\Order\Public\SetOrderProductQuantityPublicHandler;
use Illuminate\Http\JsonResponse;
use Throwable;

/**
 * « Ajouter a votre commande » de la caisse: la merch de l'evenement ajoutee a une commande
 * reservee, avant le paiement.
 */
class SetOrderProductQuantityActionPublic extends BaseAction
{
    public function __construct(
        private readonly SetOrderProductQuantityPublicHandler $handler,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function __invoke(SetOrderProductQuantityRequest $request, int $eventId, string $orderShortId): JsonResponse
    {
        $order = $this->handler->handle(
            eventId: $eventId,
            orderShortId: $orderShortId,
            productId: (int)$request->validated('product_id'),
            productPriceId: (int)$request->validated('product_price_id'),
            quantity: (int)$request->validated('quantity'),
        );

        return $this->resourceResponse(OrderResourcePublic::class, $order);
    }
}
