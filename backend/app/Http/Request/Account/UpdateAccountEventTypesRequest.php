<?php

namespace HiEvents\Http\Request\Account;

use HiEvents\DomainObjects\Enums\AccountEventType;
use HiEvents\Http\Request\BaseRequest;
use Illuminate\Validation\Rule;

class UpdateAccountEventTypesRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'event_types' => ['present', 'array'],
            'event_types.*' => ['string', Rule::in(AccountEventType::valuesArray())],
        ];
    }
}
