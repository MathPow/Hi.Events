<?php

declare(strict_types=1);

namespace HiEvents\Http\Request\Order\Square;

use HiEvents\Http\Request\BaseRequest;

class CreateSquarePaymentRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            // Jeton de carte a usage unique produit par le SDK Web Payments: la
            // carte elle-meme ne transite jamais par le serveur.
            'source_id' => ['required', 'string', 'max:512'],
            'verification_token' => ['nullable', 'string', 'max:2048'],
        ];
    }
}
