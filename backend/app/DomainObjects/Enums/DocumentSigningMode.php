<?php

namespace HiEvents\DomainObjects\Enums;

/**
 * How the participants of a linked event fill an organizer's document.
 */
enum DocumentSigningMode: string
{
    use BaseEnum;

    // Signed at checkout with the typed full name; the signed PDF goes out with the ticket.
    case ONLINE = 'ONLINE';
    // Filled with the participant's details and sent with the ticket, to sign on paper.
    case PRINT = 'PRINT';
}
