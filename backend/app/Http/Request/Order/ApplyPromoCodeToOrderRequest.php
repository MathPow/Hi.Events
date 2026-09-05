<?php

namespace HiEvents\Http\Request\Order;

use HiEvents\Http\Request\BaseRequest;

class ApplyPromoCodeToOrderRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'promo_code' => ['present', 'nullable', 'string', 'max:50'],
        ];
    }
}
