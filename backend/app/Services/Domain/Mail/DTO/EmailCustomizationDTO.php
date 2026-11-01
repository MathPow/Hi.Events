<?php

namespace HiEvents\Services\Domain\Mail\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

/**
 * The subject and message an organizer wrote for a participant email (« Courriels »), rendered.
 * Null: the default subject, no message.
 */
class EmailCustomizationDTO extends BaseDataObject
{
    public function __construct(
        public readonly ?string $subject = null,
        public readonly ?string $message = null,
    )
    {
    }
}
