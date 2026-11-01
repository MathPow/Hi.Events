<?php

namespace HiEvents\Services\Domain\Auth\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class UserAccountDTO extends BaseDataObject
{
    public function __construct(
        public readonly int    $id,
        public readonly string $name,
        public readonly bool   $is_current,
    )
    {
    }
}
