<?php

namespace HiEvents\Http\Request\Order\Deposit;

use HiEvents\Http\Request\BaseRequest;
use HiEvents\Validators\Rules\RulesHelper;

class SplitDepositRetentionRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'amount' => ['required', 'gt:0', ...RulesHelper::MONEY],
            'note' => ['required', 'string', 'max:1000'],
            'order_ids' => ['required', 'array', 'min:1'],
            'order_ids.*' => ['integer'],
            'notify' => ['boolean'],
        ];
    }
}
