<?php

namespace HiEvents\Services\Domain\EventChange;

use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\DomainObjects\Status\OrderRefundStatus;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\DTO\RefundOrderDTO;
use HiEvents\Services\Application\Handlers\Order\Payment\Stripe\RefundOrderHandler;
use HiEvents\Services\Domain\EventChange\DTO\EventOrderRefundOutcomeDTO;
use HiEvents\Services\Domain\Order\OrderCancelService;
use Illuminate\Database\DatabaseManager;
use Throwable;

/**
 * Cancels an order of a postponed or cancelled event and gives the money back the way it came:
 * a Stripe refund of what is left on the order (the refund of the Orders page, Dehors' fee
 * included), nothing for a free or unpaid order, and the organizer by hand for one paid otherwise.
 *
 * The caller holds the order's lock (lockOrder) in its transaction: two requests or two jobs for the
 * same order wait for each other, and the second one finds it cancelled.
 */
class EventOrderRefundService
{
    public function __construct(
        private readonly OrderRepositoryInterface $orderRepository,
        private readonly OrderCancelService       $orderCancelService,
        private readonly RefundOrderHandler       $refundOrderHandler,
        private readonly DatabaseManager          $databaseManager,
    )
    {
    }

    public function lockOrder(int $orderId): void
    {
        $this->databaseManager->statement('SELECT pg_advisory_xact_lock(hashtext(?))', ['event-change-order-' . $orderId]);
    }

    public function findOrder(array $where): ?OrderDomainObject
    {
        return $this->orderRepository
            ->loadRelation(new Relationship(StripePaymentDomainObject::class, name: 'stripe_payment'))
            ->findFirstWhere($where);
    }

    public function isAlreadySettled(OrderDomainObject $order): bool
    {
        return $order->isOrderCancelled()
            || $order->getRefundStatus() === OrderRefundStatus::REFUNDED->name
            || ($order->isPaymentRequired() && $this->refundableAmount($order) <= 0);
    }

    public function isUnpaid(OrderDomainObject $order): bool
    {
        return $order->isFreeOrder() || $order->isOrderAwaitingOfflinePayment();
    }

    public function isPaidOnline(OrderDomainObject $order): bool
    {
        return !$this->isUnpaid($order)
            && $order->getPaymentProvider() === PaymentProviders::STRIPE->name
            && $order->getStripePayment() !== null;
    }

    public function refundableAmount(OrderDomainObject $order): float
    {
        return round(max(0, $order->getTotalGross() - $order->getTotalRefunded()), 2);
    }

    /**
     * @throws Throwable
     */
    public function cancel(OrderDomainObject $order, bool $notifyBuyer): void
    {
        $this->orderCancelService->cancelOrder($order, notifyBuyer: $notifyBuyer);
    }

    /**
     * After cancel(): what happens to the money. A Stripe error is thrown, the caller decides
     * whether the cancellation stays.
     *
     * @throws Throwable
     */
    public function refund(OrderDomainObject $order, bool $notifyBuyer): EventOrderRefundOutcomeDTO
    {
        if ($this->isUnpaid($order)) {
            return new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::CANCELLED_NO_PAYMENT);
        }

        $amount = $this->refundableAmount($order);

        if (!$this->isPaidOnline($order)) {
            return new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::MANUAL_REFUND_REQUIRED, $amount);
        }

        $this->refundOrderHandler->handle(new RefundOrderDTO(
            event_id: $order->getEventId(),
            order_id: $order->getId(),
            amount: $amount,
            notify_buyer: $notifyBuyer,
            cancel_order: false,
        ));

        return new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::REFUNDED, $amount);
    }
}
