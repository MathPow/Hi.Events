<?php

namespace HiEvents\DomainObjects\Enums;

/**
 * Who has to fill an organizer's document.
 */
enum DocumentAudience: string
{
    use BaseEnum;

    case ALL = 'ALL';
    // Under WaiverService::ADULT_AGE on the event's day, from the date of birth asked at checkout.
    case MINORS = 'MINORS';
}
