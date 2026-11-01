<?php

namespace HiEvents\DomainObjects\Enums;

/**
 * The participant emails an organizer can change. The order confirmation and the ticket are
 * rewritten in full (Liquid editor); the others keep their content and take the organizer's
 * subject and message.
 */
enum EmailTemplateType: string
{
    use BaseEnum;

    case ORDER_CONFIRMATION = 'order_confirmation';
    case ATTENDEE_TICKET = 'attendee_ticket';
    case ORDER_FAILED = 'order_failed';
    case PAYMENT_AFTER_EXPIRY = 'payment_after_expiry';
    case ORDER_CANCELLED = 'order_cancelled';
    case ORDER_REFUNDED = 'order_refunded';
    case DEPOSIT_RESOLVED = 'deposit_resolved';
    case ORDER_DETAILS_CHANGED = 'order_details_changed';
    case ATTENDEE_DETAILS_CHANGED = 'attendee_details_changed';
    case WAITLIST_JOINED = 'waitlist_joined';
    case WAITLIST_OFFER = 'waitlist_offer';
    case WAITLIST_OFFER_EXPIRED = 'waitlist_offer_expired';

    public function hasFullEditor(): bool
    {
        return in_array($this, self::fullEditorTypes(), true);
    }

    /** @return list<self> */
    public static function fullEditorTypes(): array
    {
        return [self::ORDER_CONFIRMATION, self::ATTENDEE_TICKET];
    }

    /** @return list<self> */
    public static function messageTypes(): array
    {
        return array_values(array_filter(self::cases(), fn(self $type) => !$type->hasFullEditor()));
    }

    public function label(): string
    {
        return match ($this) {
            self::ORDER_CONFIRMATION => __('Order Confirmation'),
            self::ATTENDEE_TICKET => __('Attendee Ticket'),
            self::ORDER_FAILED => __('Order failed'),
            self::PAYMENT_AFTER_EXPIRY => __('Payment received too late'),
            self::ORDER_CANCELLED => __('Order cancelled'),
            self::ORDER_REFUNDED => __('Refund'),
            self::DEPOSIT_RESOLVED => __('Security deposit'),
            self::ORDER_DETAILS_CHANGED => __('Order changed'),
            self::ATTENDEE_DETAILS_CHANGED => __('Ticket changed'),
            self::WAITLIST_JOINED => __('Waitlist sign-up'),
            self::WAITLIST_OFFER => __('Spot available'),
            self::WAITLIST_OFFER_EXPIRED => __('Spot offer expired'),
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::ORDER_CONFIRMATION => __('Sent to the customer after placing an order'),
            self::ATTENDEE_TICKET => __('Sent to each attendee with their ticket'),
            self::ORDER_FAILED => __('Sent to the buyer when the payment fails'),
            self::PAYMENT_AFTER_EXPIRY => __('Sent to the buyer when the payment arrives after the reservation expired'),
            self::ORDER_CANCELLED => __('Sent to the buyer when you cancel their order'),
            self::ORDER_REFUNDED => __('Sent to the buyer when you refund them'),
            self::DEPOSIT_RESOLVED => __('Sent to the buyer when you return or keep their deposit'),
            self::ORDER_DETAILS_CHANGED => __('Sent to the buyer after they change their order'),
            self::ATTENDEE_DETAILS_CHANGED => __('Sent to the attendee after they change their ticket'),
            self::WAITLIST_JOINED => __('Sent when someone joins the waitlist'),
            self::WAITLIST_OFFER => __('Sent when a spot is offered from the waitlist'),
            self::WAITLIST_OFFER_EXPIRED => __('Sent when the offered spot was not taken in time'),
        };
    }
}
