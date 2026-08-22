<?php

namespace HiEvents\Http\Request\Order;

use HiEvents\Http\Request\BaseRequest;

class SetPlatformContributionRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            // Plafond volontairement bas: c'est un pourboire, pas un canal de
            // paiement. Une valeur aberrante trahit une erreur de saisie.
            'platform_contribution' => ['required', 'numeric', 'min:0', 'max:1000'],
        ];
    }
}
