<?php

namespace HiEvents\DomainObjects\Enums;

/**
 * The automatic emails shown on the organizer's « Courriels » page: those the participants
 * receive (and the organizer can change), then those the organizer receives (preview only).
 */
enum AutomaticEmailType: string
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
    case ORGANIZER_NEW_ORDER = 'organizer_new_order';
    case ORGANIZER_CONTACT_MESSAGE = 'organizer_contact_message';

    /** The participant email the organizer can change, or null for an email they receive. */
    public function templateType(): ?EmailTemplateType
    {
        return EmailTemplateType::tryFrom($this->value);
    }
}
