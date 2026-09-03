<?php

declare(strict_types=1);

namespace HiEvents\Http\Request\Account\Square;

use HiEvents\Http\Request\BaseRequest;

class CompleteSquareAuthorizationRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:512'],
            'state' => ['required', 'string'],
        ];
    }
}
