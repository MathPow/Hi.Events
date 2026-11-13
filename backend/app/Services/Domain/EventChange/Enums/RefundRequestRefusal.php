<?php

namespace HiEvents\Services\Domain\EventChange\Enums;

enum RefundRequestRefusal
{
    case DEADLINE_PASSED;
    case REFUNDS_NOT_ALLOWED;
    case ALREADY_CANCELLED;
    case ALREADY_REFUNDED;
    case CHECKED_IN;
    case EVENT_CANCELLED;
    case LINK_REPLACED;

    public function message(): string
    {
        return match ($this) {
            self::DEADLINE_PASSED => __('The deadline to ask for a refund has passed.'),
            self::REFUNDS_NOT_ALLOWED => __('The organizer does not offer refunds for this change of date.'),
            self::ALREADY_CANCELLED => __('This order is already cancelled.'),
            self::ALREADY_REFUNDED => __('This order has already been refunded.'),
            self::CHECKED_IN => __('A ticket of this order has already been checked in.'),
            self::EVENT_CANCELLED => __('The event has been cancelled: the organizer will tell you what happens to your order.'),
            self::LINK_REPLACED => __('The date of the event changed again: use the link in the latest email.'),
        };
    }
}
