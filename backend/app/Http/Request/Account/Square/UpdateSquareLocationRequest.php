<?php

declare(strict_types=1);

namespace HiEvents\Http\Request\Account\Square;

use HiEvents\Http\Request\BaseRequest;

class UpdateSquareLocationRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'location_id' => ['required', 'string', 'max:191'],
        ];
    }
}
