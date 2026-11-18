<?php

namespace HiEvents\DomainObjects\Enums;

/**
 * Why a participant cannot give their ticket to someone else.
 */
enum TicketTransferRefusal: string
{
    use BaseEnum;

    case DISABLED = 'DISABLED';
    case DEADLINE_PASSED = 'DEADLINE_PASSED';
    case ORDER_NOT_COMPLETED = 'ORDER_NOT_COMPLETED';
    case TICKET_NOT_ACTIVE = 'TICKET_NOT_ACTIVE';
    case CHECKED_IN = 'CHECKED_IN';
    case SAME_EMAIL = 'SAME_EMAIL';

    public function message(): string
    {
        return match ($this) {
            self::DISABLED => __('This event does not allow ticket transfers.'),
            self::DEADLINE_PASSED => __('The deadline to transfer this ticket has passed.'),
            self::ORDER_NOT_COMPLETED => __('This ticket can be transferred once the order is paid.'),
            self::TICKET_NOT_ACTIVE => __('This ticket is no longer valid.'),
            self::CHECKED_IN => __('This ticket has already been used at the entrance.'),
            self::SAME_EMAIL => __('The new participant\'s email must be different from the current one.'),
        };
    }
}
