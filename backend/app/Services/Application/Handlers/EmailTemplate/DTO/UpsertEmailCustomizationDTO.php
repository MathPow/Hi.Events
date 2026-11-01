<?php

namespace HiEvents\Services\Application\Handlers\EmailTemplate\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;

class UpsertEmailCustomizationDTO extends BaseDataObject
{
    public function __construct(
        public readonly int               $accountId,
        public readonly int               $organizerId,
        public readonly EmailTemplateType $type,
        public readonly ?string           $subject,
        public readonly ?string           $message,
    )
    {
    }
}
