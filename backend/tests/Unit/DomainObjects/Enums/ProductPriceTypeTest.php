<?php

namespace Tests\Unit\DomainObjects\Enums;

use HiEvents\DomainObjects\Enums\ProductPriceType;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use Illuminate\Support\Collection;
use Tests\TestCase;

class ProductPriceTypeTest extends TestCase
{
    public function testOnlyTieredAndSizedHaveMultiplePrices(): void
    {
        $this->assertTrue(ProductPriceType::TIERED->hasMultiplePrices());
        $this->assertTrue(ProductPriceType::SIZED->hasMultiplePrices());
        $this->assertFalse(ProductPriceType::PAID->hasMultiplePrices());
        $this->assertFalse(ProductPriceType::FREE->hasMultiplePrices());
        $this->assertFalse(ProductPriceType::DONATION->hasMultiplePrices());
    }

    public function testSizedProductSumsStockAcrossSizesAndExposesSharedPrice(): void
    {
        $product = (new ProductDomainObject())
            ->setType(ProductPriceType::SIZED->name)
            ->setProductPrices(new Collection([
                (new ProductPriceDomainObject())->setId(1)->setLabel('S')->setPrice(25.00)->setInitialQuantityAvailable(10),
                (new ProductPriceDomainObject())->setId(2)->setLabel('M')->setPrice(25.00)->setInitialQuantityAvailable(15),
            ]));

        $this->assertTrue($product->hasMultiplePrices());
        $this->assertFalse($product->isTieredType());
        $this->assertSame(25, $product->getInitialQuantityAvailable());
        $this->assertSame(25.00, $product->getPrice());
    }

    public function testSizedProductWithoutVisibleSizesIsUnavailable(): void
    {
        $product = (new ProductDomainObject())
            ->setType(ProductPriceType::SIZED->name)
            ->setProductPrices(new Collection());

        $this->assertFalse($product->isAvailable());
    }
}
