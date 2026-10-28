<?php

namespace HiEvents\Services\Application\Handlers\Account\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class UpdateAccountEventTypesDTO extends BaseDataObject
{
    public function __construct(
        public readonly int   $accountId,
        public readonly array $eventTypes,
    )
    {
    }
}
