<?php

namespace HiEvents\Http\Request\CheckInList;

use HiEvents\Http\Request\BaseRequest;
use HiEvents\Locale;
use HiEvents\Validators\Rules\RulesHelper;
use Illuminate\Validation\Rule;

class CreateDoorSaleRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'int'],
            'product_price_id' => ['nullable', 'int'],
            'quantity' => ['required', 'int', 'min:1', 'max:10'],
            'first_name' => RulesHelper::REQUIRED_STRING,
            'last_name' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email'],
            'check_in_immediately' => ['boolean'],
            'locale' => ['nullable', Rule::in(Locale::getSupportedLocales())],
        ];
    }

    public function messages(): array
    {
        return [
            'quantity.max' => __('You can sell up to 10 tickets at a time.'),
        ];
    }
}
