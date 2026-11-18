<?php

namespace HiEvents\DomainObjects\Status;

use HiEvents\DomainObjects\Enums\BaseEnum;

enum EventChangeRefundStatus
{
    use BaseEnum;

    // Waiting for its job (cancelled event)
    case PENDING;

    // Cancelled, and the Stripe refund was sent
    case REFUNDED;

    // Cancelled, nothing was paid (free, or offline payment never received)
    case CANCELLED_NO_PAYMENT;

    // Cancelled, paid another way than online: the organizer refunds it by hand
    case MANUAL_REFUND_REQUIRED;

    // Cancelled without refund: the organizer turned automatic refunds off
    case NOT_REFUNDED;

    // Left alone: already cancelled or fully refunded before
    case SKIPPED;

    // The cancellation or the refund failed
    case FAILED;
}
