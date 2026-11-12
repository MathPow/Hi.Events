<?php

namespace HiEvents\Http\Request\User;

use HiEvents\Http\Request\BaseRequest;

class UpdateUserNotificationEmailsRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'organizer_messages' => ['required_without:new_orders', 'boolean'],
            'new_orders' => ['required_without:organizer_messages', 'boolean'],
        ];
    }
}
