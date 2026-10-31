<?php

namespace HiEvents\Http\Request\Order;

use HiEvents\Http\Request\BaseRequest;

class SetOrderProductQuantityRequest extends BaseRequest
{
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer'],
            'product_price_id' => ['required', 'integer'],
            // La quantite voulue pour ce prix dans la commande (0 la retire), pas un increment:
            // un double clic ou une requete rejouee ne double pas l'ajout.
            'quantity' => ['required', 'integer', 'min:0', 'max:100'],
        ];
    }
}
