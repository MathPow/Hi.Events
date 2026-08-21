<?php

namespace HiEvents\DomainObjects\Status;

use HiEvents\DomainObjects\Enums\BaseEnum;

/**
 * Un recu officiel ne se supprime pas: son numero est consomme a vie. Corriger
 * revient a passer l'original en REPLACED et a emettre un nouveau recu qui le
 * designe via replaces_receipt_id.
 */
enum DonationReceiptStatus
{
    use BaseEnum;

    case ISSUED;
    case REPLACED;
}
