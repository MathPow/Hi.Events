<?php

namespace HiEvents\Resources\DoorSale;

use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProductDomainObject
 */
class DoorSaleProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getId(),
            'title' => $this->getTitle(),
            'prices' => $this->getProductPrices()?->map(fn(ProductPriceDomainObject $price) => [
                'id' => $price->getId(),
                'label' => $price->getLabel(),
                'price' => $price->getPrice(),
                'quantity_remaining' => $price->getQuantityAvailable(),
                'is_available' => $price->isAvailable(),
            ])->values() ?? [],
        ];
    }
}
