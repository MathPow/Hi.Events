<?php

namespace HiEvents\Services\Domain\Attendee\Transfer\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class TicketTransferRecipientDTO extends BaseDataObject
{
    public function __construct(
        public readonly string $first_name,
        public readonly string $last_name,
        public readonly string $email,
    )
    {
    }
}
