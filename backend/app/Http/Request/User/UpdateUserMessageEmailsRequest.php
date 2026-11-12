<?php

namespace HiEvents\Http\Request\User;

use HiEvents\Http\Request\BaseRequest;

class UpdateUserMessageEmailsRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
        ];
    }
}
