<?php

namespace HiEvents\Services\Application\Handlers\Attendee\Public\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class TransferTicketPublicDTO extends BaseDataObject
{
    public function __construct(
        public readonly int     $eventId,
        public readonly string  $attendeeShortId,
        public readonly string  $firstName,
        public readonly string  $lastName,
        public readonly string  $email,
        public readonly ?string $ipAddress,
    )
    {
    }
}
