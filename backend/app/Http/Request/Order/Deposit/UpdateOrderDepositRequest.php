<?php

namespace HiEvents\Http\Request\Order\Deposit;

use HiEvents\DomainObjects\Status\OrderDepositStatus;
use HiEvents\Http\Request\BaseRequest;
use HiEvents\Validators\Rules\RulesHelper;
use Illuminate\Validation\Rule;

class UpdateOrderDepositRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(OrderDepositStatus::valuesArray())],
            'retained_amount' => ['nullable', ...RulesHelper::MONEY],
            'note' => ['nullable', 'string', 'max:1000'],
            'notify' => ['boolean'],
        ];
    }
}
