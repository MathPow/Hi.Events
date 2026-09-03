<?php

declare(strict_types=1);

namespace HiEvents\Http\Request\Admin;

use HiEvents\Http\Request\BaseRequest;

class CreateRegistrationInviteRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'email' => ['nullable', 'email', 'max:255'],
            'label' => ['nullable', 'string', 'max:255'],
            'expires_in_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ];
    }
}
