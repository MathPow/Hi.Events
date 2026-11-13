<?php

namespace HiEvents\Http\Request\EventChange;

use HiEvents\Http\Request\BaseRequest;

class PostponeEventRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after:start_date'],
            'message' => ['required', 'string', 'max:5000'],
            'refunds_allowed' => ['required', 'boolean'],
            'refund_deadline' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'end_date.after' => __('The end must be after the start.'),
            'message.required' => __('Write a message to the participants.'),
        ];
    }
}
