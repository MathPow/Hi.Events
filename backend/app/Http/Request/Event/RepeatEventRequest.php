<?php

namespace HiEvents\Http\Request\Event;

use HiEvents\Http\Request\BaseRequest;
use HiEvents\Services\Domain\Event\RecurringEvent\RecurringEventDateService;

class RepeatEventRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'dates' => ['required', 'array', 'min:1', 'max:' . RecurringEventDateService::MAX_OCCURRENCES],
            'dates.*' => ['required', 'date_format:Y-m-d', 'distinct'],
        ];
    }

    public function messages(): array
    {
        return [
            'dates.required' => __('Choose at least one date.'),
            'dates.min' => __('Choose at least one date.'),
            'dates.max' => __('You can add at most :max dates at a time.', [
                'max' => RecurringEventDateService::MAX_OCCURRENCES,
            ]),
            'dates.*.date_format' => __('This date is not valid.'),
            'dates.*.distinct' => __('Each date can only be chosen once.'),
        ];
    }
}
