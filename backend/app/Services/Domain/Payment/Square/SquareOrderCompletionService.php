<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Payment\Square;

use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\Generated\EventSettingDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrderDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\DomainObjects\Status\OrderPaymentStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Events\OrderStatusChangedEvent;
use HiEvents\Repository\Interfaces\AffiliateRepositoryInterface;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\Product\ProductQuantityUpdateService;
use HiEvents\Services\Infrastructure\DomainEvents\DomainEventDispatcherService;
use HiEvents\Services\Infrastructure\DomainEvents\Enums\DomainEventType;
use HiEvents\Services\Infrastructure\DomainEvents\Events\OrderEvent;

/**
 * Bascule une commande payee par Square en commande completee.
 *
 * Square capture le paiement dans l'appel lui-meme: contrairement a Stripe, il
 * n'y a pas de webhook a attendre pour savoir que l'argent est pris, et laisser
 * la commande en attente ne ferait que retarder l'envoi des billets.
 */
class SquareOrderCompletionService
{
    public function __construct(
        private readonly OrderRepositoryInterface         $orderRepository,
        private readonly AttendeeRepositoryInterface      $attendeeRepository,
        private readonly AffiliateRepositoryInterface     $affiliateRepository,
        private readonly ProductQuantityUpdateService     $quantityUpdateService,
        private readonly EventSettingsRepositoryInterface $eventSettingsRepository,
        private readonly DomainEventDispatcherService     $domainEventDispatcherService,
    )
    {
    }

    public function complete(int $orderId): OrderDomainObject
    {
        $order = $this->orderRepository
            ->loadRelation(OrderItemDomainObject::class)
            ->updateFromArray($orderId, [
                OrderDomainObjectAbstract::PAYMENT_STATUS => OrderPaymentStatus::PAYMENT_RECEIVED->name,
                OrderDomainObjectAbstract::STATUS => OrderStatus::COMPLETED->name,
                OrderDomainObjectAbstract::PAYMENT_PROVIDER => PaymentProviders::SQUARE->value,
            ]);

        $this->attendeeRepository->updateWhere(
            attributes: [
                'status' => AttendeeStatus::ACTIVE->name,
            ],
            where: [
                'order_id' => $order->getId(),
                'status' => AttendeeStatus::AWAITING_PAYMENT->name,
            ],
        );

        $this->quantityUpdateService->updateQuantitiesFromOrder($order);

        if ($order->getAffiliateId()) {
            $this->affiliateRepository->incrementSales(
                affiliateId: $order->getAffiliateId(),
                amount: $order->getTotalGross(),
            );
        }

        $eventSettings = $this->eventSettingsRepository->findFirstWhere([
            EventSettingDomainObjectAbstract::EVENT_ID => $order->getEventId(),
        ]);

        event(new OrderStatusChangedEvent($order, createInvoice: $eventSettings?->getEnableInvoicing() ?? false));

        $this->domainEventDispatcherService->dispatch(
            new OrderEvent(
                type: DomainEventType::ORDER_CREATED,
                orderId: $order->getId(),
            ),
        );

        return $order;
    }
}
