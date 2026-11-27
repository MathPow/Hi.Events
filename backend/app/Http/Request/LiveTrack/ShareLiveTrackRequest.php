<?php

namespace HiEvents\Http\Request\LiveTrack;

use HiEvents\Http\Request\BaseRequest;

class ShareLiveTrackRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'link' => ['required', 'string', 'max:5000'],
            'consent' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'link.required' => __('Paste your LiveTrack link.'),
            'consent.accepted' => __('Accept that the organizer sees your position to share it.'),
        ];
    }
}
