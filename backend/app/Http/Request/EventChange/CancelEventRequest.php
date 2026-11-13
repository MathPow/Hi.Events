<?php

namespace HiEvents\Http\Request\EventChange;

use HiEvents\Http\Request\BaseRequest;

class CancelEventRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'max:5000'],
            'refund_orders' => ['required', 'boolean'],
            'confirmed' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'message.required' => __('Write a message to the participants.'),
            'confirmed.accepted' => __('Confirm that you want to cancel the event.'),
        ];
    }
}
