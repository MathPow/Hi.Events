<?php

namespace HiEvents\Services\Application\Handlers\User\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class UpdateUserMessageEmailsDTO extends BaseDataObject
{
    public function __construct(
        public readonly int  $user_id,
        public readonly int  $account_id,
        public readonly bool $enabled,
    )
    {
    }
}
