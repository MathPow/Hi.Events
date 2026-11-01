<?php

namespace HiEvents\Services\Application\Handlers\Organizer\PageImport\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class ImportOrganizerPageDTO extends BaseDataObject
{
    public function __construct(
        public readonly int    $accountId,
        public readonly ?int   $userId,
        public readonly string $url,
    )
    {
    }
}
