<?php

namespace HiEvents\Http\Request\CheckInList;

use HiEvents\Http\Request\BaseRequest;
use HiEvents\Validators\Rules\RulesHelper;

class UpsertCheckInListRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'name' => RulesHelper::REQUIRED_STRING,
            'description' => ['nullable', 'string', 'max:255'],
            'expires_at' => ['nullable', 'date'],
            'activates_at' => ['nullable', 'date'],
            'product_ids' => ['required', 'array', 'min:1'],
            'pin' => ['nullable', 'string', 'min:4', 'max:12', 'regex:/^[0-9]+$/'],
            'allow_door_sales' => ['boolean'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->sometimes('expires_at', 'after:activates_at', function ($input) {
            return $input->activates_at !== null && $input->expires_at !== null;
        });

        $validator->sometimes('activates_at', 'before:expires_at', function ($input) {
            return $input->activates_at !== null && $input->expires_at !== null;
        });
    }

    public function messages(): array
    {
        return [
            'product_ids.required' => __('Please select at least one product.'),
            'pin.regex' => __('The PIN must contain digits only.'),
            'pin.min' => __('The PIN must be at least 4 digits.'),
            'expires_at.after' => __('The expiration date must be after the activation date.'),
            'activates_at.before' => __('The activation date must be before the expiration date.'),
        ];
    }
}
