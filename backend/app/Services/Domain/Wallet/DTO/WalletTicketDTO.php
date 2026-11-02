<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Wallet\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

/** One ticket: its QR code is the attendee's public id, as on the confirmation page. */
class WalletTicketDTO extends BaseDataObject
{
    public function __construct(
        public readonly int     $attendeeId,
        public readonly string  $publicId,
        public readonly string  $holderName,
        public readonly ?string $ticketName,
    )
    {
    }
}
