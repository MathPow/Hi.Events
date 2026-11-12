<?php

namespace HiEvents\Services\Application\Handlers\User\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class UpdateUserNotificationEmailsDTO extends BaseDataObject
{
    public function __construct(
        public readonly int   $user_id,
        public readonly int   $account_id,
        public readonly ?bool $organizer_messages = null,
        public readonly ?bool $new_orders = null,
    )
    {
    }
}
