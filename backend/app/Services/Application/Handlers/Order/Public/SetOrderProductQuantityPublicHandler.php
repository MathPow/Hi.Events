<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\Order\Public;

use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\ProductDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\DomainObjects\Status\OrderPaymentStatus;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Exceptions\UnauthorizedException;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderItemRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\DTO\ProductOrderDetailsDTO;
use HiEvents\Services\Domain\Order\OrderCreateRequestValidationService;
use HiEvents\Services\Domain\Order\OrderItemProcessingService;
use HiEvents\Services\Domain\Order\OrderManagementService;
use HiEvents\Services\Domain\Product\DTO\OrderProductPriceDTO;
use HiEvents\Services\Infrastructure\Session\CheckoutSessionManagementService;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use HiEvents\Exceptions\ResourceNotFoundException;
use Throwable;

/**
 * Fixe la quantite d'un produit (la merch: produits GENERAL) dans une commande reservee, depuis
 * l'etape des coordonnees de la caisse. Les lignes sont recalculees comme pour un code promo
 * (ApplyPromoCodeToOrderHandler): taxes, frais et totaux suivent.
 */
class SetOrderProductQuantityPublicHandler
{
    public function __construct(
        private readonly OrderRepositoryInterface            $orderRepository,
        private readonly OrderItemRepositoryInterface        $orderItemRepository,
        private readonly EventRepositoryInterface            $eventRepository,
        private readonly ProductRepositoryInterface          $productRepository,
        private readonly PromoCodeRepositoryInterface        $promoCodeRepository,
        private readonly OrderCreateRequestValidationService $orderValidationService,
        private readonly OrderItemProcessingService          $orderItemProcessingService,
        private readonly OrderManagementService              $orderManagementService,
        private readonly CheckoutSessionManagementService    $sessionManagementService,
        private readonly DatabaseManager                     $databaseManager,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function handle(int $eventId, string $orderShortId, int $productId, int $productPriceId, int $quantity): OrderDomainObject
    {
        return $this->databaseManager->transaction(function () use ($eventId, $orderShortId, $productId, $productPriceId, $quantity) {
            $order = $this->orderRepository
                ->loadRelation(OrderItemDomainObject::class)
                ->loadRelation(new Relationship(StripePaymentDomainObject::class, name: 'stripe_payment'))
                ->findFirstWhere(['short_id' => $orderShortId, 'event_id' => $eventId]);

            if ($order === null) {
                throw new ResourceNotFoundException(__('Order not found'));
            }

            // Comme la fin de commande: seul le navigateur qui a reserve la commande la modifie.
            if ($order->getSessionId() === null || !$this->sessionManagementService->verifySession($order->getSessionId())) {
                throw new UnauthorizedException(
                    __('Sorry, we could not verify your session. Please restart your order.')
                );
            }

            if (!$order->isOrderReserved() || $order->isReservedOrderExpired()) {
                throw new ResourceConflictException(__('This order can no longer be modified.'));
            }

            // Le PaymentIntent Stripe est cree a l'etape du paiement puis reutilise tel quel
            // (CreatePaymentIntentHandler): un ajout apres coup ne serait pas debite.
            // Pareil une fois les coordonnees envoyees (courriel pose, paiement attendu): les
            // participants sont crees et l'acheteur peut revenir a cette etape depuis le paiement,
            // ou le PaymentIntent deja cree garderait l'ancien montant.
            if ($order->getStripePayment() !== null
                || $order->getEmail() !== null
                || $order->getPaymentStatus() === OrderPaymentStatus::AWAITING_PAYMENT->name) {
                throw new ResourceConflictException(__('This order can no longer be modified.'));
            }

            $product = $this->productRepository
                ->loadRelation(ProductPriceDomainObject::class)
                ->findFirstWhere([
                    ProductDomainObjectAbstract::ID => $productId,
                    ProductDomainObjectAbstract::EVENT_ID => $eventId,
                ]);

            // Seulement la merch: un billet demanderait un participant de plus a l'etape des
            // coordonnees, et un don un montant choisi.
            if ($product === null
                || $product->getProductType() !== ProductType::GENERAL->name
                || $product->isDonationType()
                || !$this->productHasPrice($product, $productPriceId)) {
                throw ValidationException::withMessages([
                    'product_id' => __('This product cannot be added to the order.'),
                ]);
            }

            $orderItems = $order->getOrderItems() ?? collect();
            $currentQuantity = (int)$orderItems
                ->filter(fn(OrderItemDomainObject $item) => $item->getProductPriceId() === $productPriceId)
                ->sum(fn(OrderItemDomainObject $item) => $item->getQuantity());

            if ($quantity === $currentQuantity) {
                return $order;
            }

            if ($quantity > $currentQuantity) {
                $this->validateIncrease($eventId, $product, $productPriceId, $quantity - $currentQuantity, $orderItems, $quantity);
            }

            $promoCode = $order->getPromoCodeId() !== null
                ? $this->promoCodeRepository->findFirstWhere(['id' => $order->getPromoCodeId()])
                : null;

            $event = $this->eventRepository
                ->loadRelation(EventSettingDomainObject::class)
                ->findById($eventId);

            $productOrderDetails = $this->buildProductOrderDetails($orderItems, $productId, $productPriceId, $quantity);

            $this->orderItemRepository->deleteWhere(['order_id' => $order->getId()]);

            $newOrderItems = $this->orderItemProcessingService->process(
                order: $order,
                productsOrderDetails: $productOrderDetails,
                event: $event,
                promoCode: $promoCode instanceof PromoCodeDomainObject ? $promoCode : null,
            );

            return $this->orderManagementService->updateOrderTotals($order, $newOrderItems);
        });
    }

    private function productHasPrice(ProductDomainObject $product, int $productPriceId): bool
    {
        return (bool)$product->getProductPrices()
            ?->first(fn(ProductPriceDomainObject $price) => $price->getId() === $productPriceId);
    }

    /**
     * Ce qu'on ajoute passe par les verifications de la creation de commande (visibilite, periode
     * de vente, epuise, stock et capacites): les quantites disponibles excluent deja ce que la
     * commande reserve, on n'y verifie donc que l'ajout. Le maximum par commande, lui, porte sur
     * tout ce que la commande contiendra de ce produit.
     *
     * @param Collection<OrderItemDomainObject> $orderItems
     * @throws ValidationException
     */
    private function validateIncrease(
        int                 $eventId,
        ProductDomainObject $product,
        int                 $productPriceId,
        int                 $added,
        Collection          $orderItems,
        int                 $newQuantityForPrice,
    ): void
    {
        $this->orderValidationService->validateRequestData($eventId, [
            'products' => [[
                'product_id' => $product->getId(),
                'quantities' => [['price_id' => $productPriceId, 'quantity' => $added]],
            ]],
        ]);

        $otherPricesQuantity = (int)$orderItems
            ->filter(fn(OrderItemDomainObject $item) => $item->getProductId() === $product->getId()
                && $item->getProductPriceId() !== $productPriceId)
            ->sum(fn(OrderItemDomainObject $item) => $item->getQuantity());

        $maxPerOrder = (int)$product->getMaxPerOrder() ?: 100;

        if ($otherPricesQuantity + $newQuantityForPrice > $maxPerOrder) {
            throw ValidationException::withMessages([
                'quantity' => __('The maximum number of products available for :products is :max', [
                    'max' => $maxPerOrder,
                    'products' => $product->getTitle(),
                ]),
            ]);
        }
    }

    /**
     * Les lignes actuelles, celle de ce prix remplacee par la nouvelle quantite.
     *
     * @param Collection<OrderItemDomainObject> $orderItems
     * @return Collection<ProductOrderDetailsDTO>
     */
    private function buildProductOrderDetails(Collection $orderItems, int $productId, int $productPriceId, int $quantity): Collection
    {
        // Dans l'ordre actuel des lignes, celle de ce prix changee sur place: les fiches du
        // formulaire de la caisse (une par article, dans cet ordre) ne se decalent pas.
        $details = $orderItems
            ->map(fn(OrderItemDomainObject $item) => [
                'product_id' => $item->getProductId(),
                'price' => new OrderProductPriceDTO(
                    quantity: $item->getProductPriceId() === $productPriceId ? $quantity : $item->getQuantity(),
                    price_id: $item->getProductPriceId(),
                    // Le montant d'un don n'est pas derive du produit: on le rejoue tel quel.
                    price: $item->getPriceBeforeDiscount() ?? $item->getPrice(),
                ),
            ])
            ->filter(fn(array $row) => $row['price']->quantity > 0)
            ->values();

        $alreadyInOrder = $orderItems->contains(fn(OrderItemDomainObject $item) => $item->getProductPriceId() === $productPriceId);

        if (!$alreadyInOrder && $quantity > 0) {
            $details->push([
                'product_id' => $productId,
                'price' => new OrderProductPriceDTO(quantity: $quantity, price_id: $productPriceId),
            ]);
        }

        return $details
            ->groupBy('product_id')
            ->map(fn(Collection $rows, int|string $id) => new ProductOrderDetailsDTO(
                product_id: (int)$id,
                quantities: $rows->pluck('price')->values(),
            ))
            ->values();
    }
}
