<?php

namespace HiEvents\Services\Application\Handlers\Organizer\Messages\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class ReplyToOrganizerMessageDTO extends BaseDataObject
{
    public function __construct(
        public int    $organizer_id,
        public int    $message_id,
        public string $reply,
        // The language of the person answering: their answer is written in it, the email follows.
        public ?string $locale = null,
        public ?int    $user_id = null,
    )
    {
    }
}
