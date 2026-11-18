<?php

namespace HiEvents\Services\Domain\EventChange;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrderDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\EventChange\DTO\EventChangeRecipientsDTO;

/**
 * Who hears about a postponed or cancelled event: the buyer of every order still standing (once per
 * order, as each order has its own refund), then the participants who did not buy, once per address.
 */
class EventChangeRecipientService
{
    public const ACTIVE_ORDER_STATUSES = [
        OrderStatus::COMPLETED,
        OrderStatus::AWAITING_OFFLINE_PAYMENT,
    ];

    public function __construct(
        private readonly OrderRepositoryInterface    $orderRepository,
        private readonly AttendeeRepositoryInterface $attendeeRepository,
    )
    {
    }

    public function forEvent(int $eventId): EventChangeRecipientsDTO
    {
        $orders = $this->orderRepository
            ->loadRelation(new Relationship(StripePaymentDomainObject::class, name: 'stripe_payment'))
            ->findWhere([
                OrderDomainObjectAbstract::EVENT_ID => $eventId,
                [OrderDomainObjectAbstract::STATUS, 'in', array_map(fn(OrderStatus $status) => $status->name, self::ACTIVE_ORDER_STATUSES)],
            ])
            ->sortBy(fn(OrderDomainObject $order) => $order->getId())
            ->values();

        $orderIds = $orders->map(fn(OrderDomainObject $order) => $order->getId())->flip();
        $buyerEmails = $orders->map(fn(OrderDomainObject $order) => $this->normalize($order->getEmail()))->flip();

        $attendees = $this->attendeeRepository
            ->findWhere([
                AttendeeDomainObjectAbstract::EVENT_ID => $eventId,
                [AttendeeDomainObjectAbstract::STATUS, 'in', [AttendeeStatus::ACTIVE->name, AttendeeStatus::AWAITING_PAYMENT->name]],
            ])
            ->filter(fn(AttendeeDomainObject $attendee) => $orderIds->has($attendee->getOrderId())
                && $this->normalize($attendee->getEmail()) !== ''
                && !$buyerEmails->has($this->normalize($attendee->getEmail())))
            ->sortBy(fn(AttendeeDomainObject $attendee) => $attendee->getId())
            ->unique(fn(AttendeeDomainObject $attendee) => $this->normalize($attendee->getEmail()))
            ->values();

        return new EventChangeRecipientsDTO(orders: $orders, attendees: $attendees);
    }

    private function normalize(?string $email): string
    {
        return mb_strtolower(trim((string)$email));
    }
}
