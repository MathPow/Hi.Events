<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\EmailTemplate\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;

class SendOrganizerTestEmailDTO extends BaseDataObject
{
    public function __construct(
        public readonly int               $organizerId,
        public readonly int               $accountId,
        public readonly int               $userId,
        public readonly EmailTemplateType $type,
    )
    {
    }
}
