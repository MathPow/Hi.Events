<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Order\Public;

use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\PromoCodeDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\Exceptions\InvalidPromoCodeException;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderItemRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\DTO\ProductOrderDetailsDTO;
use HiEvents\Services\Domain\Order\OrderItemProcessingService;
use HiEvents\Services\Domain\Order\OrderManagementService;
use HiEvents\Services\Domain\Product\DTO\OrderProductPriceDTO;
use HiEvents\Services\Domain\PromoCode\PromoCodeUsageValidationService;
use HiEvents\Exceptions\ResourceNotFoundException;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Throwable;

class ApplyPromoCodeToOrderHandler
{
    public function __construct(
        private readonly OrderRepositoryInterface        $orderRepository,
        private readonly OrderItemRepositoryInterface    $orderItemRepository,
        private readonly EventRepositoryInterface        $eventRepository,
        private readonly PromoCodeRepositoryInterface    $promoCodeRepository,
        private readonly PromoCodeUsageValidationService $promoCodeUsageValidationService,
        private readonly OrderItemProcessingService      $orderItemProcessingService,
        private readonly OrderManagementService          $orderManagementService,
        private readonly DatabaseManager                 $databaseManager,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function handle(int $eventId, string $orderShortId, ?string $promoCode): OrderDomainObject
    {
        return $this->databaseManager->transaction(function () use ($eventId, $orderShortId, $promoCode) {
            $order = $this->orderRepository
                ->loadRelation(OrderItemDomainObject::class)
                ->findFirstWhere(['short_id' => $orderShortId, 'event_id' => $eventId]);

            if ($order === null) {
                throw new ResourceNotFoundException(__('Order not found'));
            }

            // Les lignes d'une commande payee sont le justificatif du montant
            // debite: les recalculer apres coup ferait diverger la facture du
            // paiement reellement encaisse.
            if (!$order->isOrderReserved() || $order->isReservedOrderExpired()) {
                throw new ResourceConflictException(__('This order can no longer be modified.'));
            }

            $resolvedPromoCode = $this->resolvePromoCode($promoCode, $eventId, $order);

            $event = $this->eventRepository
                ->loadRelation(EventSettingDomainObject::class)
                ->findById($eventId);

            $productOrderDetails = $this->buildProductOrderDetails($order);

            $this->orderItemRepository->deleteWhere(['order_id' => $order->getId()]);

            $orderItems = $this->orderItemProcessingService->process(
                order: $order,
                productsOrderDetails: $productOrderDetails,
                event: $event,
                promoCode: $resolvedPromoCode,
            );

            $this->orderRepository->updateFromArray($order->getId(), [
                'promo_code_id' => $resolvedPromoCode?->getId(),
                'promo_code' => $resolvedPromoCode?->getCode(),
            ]);

            return $this->orderManagementService->updateOrderTotals($order, $orderItems);
        });
    }

    /**
     * @throws InvalidPromoCodeException
     */
    private function resolvePromoCode(?string $promoCode, int $eventId, OrderDomainObject $order): ?PromoCodeDomainObject
    {
        if ($promoCode === null || trim($promoCode) === '') {
            return null;
        }

        $existingPromoCode = $this->promoCodeRepository->findFirstWhere([
            PromoCodeDomainObjectAbstract::CODE => strtolower(trim($promoCode)),
            PromoCodeDomainObjectAbstract::EVENT_ID => $eventId,
        ]);

        // Une reservation qui detient deja le code se compte elle-meme dans le
        // quota d'utilisations: sans cette sortie, la reappliquer echouerait des
        // que le code touche sa derniere unite disponible.
        if ($existingPromoCode !== null && $existingPromoCode->getId() === $order->getPromoCodeId()) {
            return $existingPromoCode;
        }

        if (!$this->promoCodeUsageValidationService->isPromoCodeUsable($existingPromoCode)) {
            throw new InvalidPromoCodeException(__('This promo code is invalid or has expired.'));
        }

        return $existingPromoCode;
    }

    /**
     * @return Collection<ProductOrderDetailsDTO>
     */
    private function buildProductOrderDetails(OrderDomainObject $order): Collection
    {
        return $order->getOrderItems()
            ->groupBy(fn(OrderItemDomainObject $orderItem) => $orderItem->getProductId())
            ->map(fn(Collection $orderItems, int|string $productId) => new ProductOrderDetailsDTO(
                product_id: (int)$productId,
                quantities: $orderItems->map(fn(OrderItemDomainObject $orderItem) => new OrderProductPriceDTO(
                    quantity: $orderItem->getQuantity(),
                    price_id: $orderItem->getProductPriceId(),
                    // Le montant d'un don n'est pas derive du produit: sans le
                    // rejouer ici, recalculer la commande ecraserait le choix de
                    // l'acheteur par le minimum configure.
                    price: $orderItem->getPriceBeforeDiscount() ?? $orderItem->getPrice(),
                ))->values(),
            ))
            ->values();
    }
}
