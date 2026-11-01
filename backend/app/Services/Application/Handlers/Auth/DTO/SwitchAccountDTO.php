<?php

namespace HiEvents\Services\Application\Handlers\Auth\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class SwitchAccountDTO extends BaseDataObject
{
    public function __construct(
        public readonly int  $userId,
        public readonly int  $accountId,
        public readonly bool $isImpersonating,
    )
    {
    }
}
