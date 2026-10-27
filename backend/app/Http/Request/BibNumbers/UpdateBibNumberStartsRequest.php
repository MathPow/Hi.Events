<?php

namespace HiEvents\Http\Request\BibNumbers;

use HiEvents\Http\Request\BaseRequest;

class UpdateBibNumberStartsRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'starts' => ['present', 'array'],
            'starts.*.product_price_id' => ['required', 'integer'],
            'starts.*.bib_number_start' => ['nullable', 'integer', 'min:1', 'max:999999'],
        ];
    }

    public function messages(): array
    {
        return [
            'starts.*.bib_number_start.min' => __('The first bib number must be at least 1.'),
        ];
    }
}
