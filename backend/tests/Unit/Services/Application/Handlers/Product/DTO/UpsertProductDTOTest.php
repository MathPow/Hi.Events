<?php

namespace Tests\Unit\Services\Application\Handlers\Product\DTO;

use HiEvents\DomainObjects\Enums\ProductPriceType;
use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\Services\Application\Handlers\Product\DTO\UpsertProductDTO;
use Tests\TestCase;

class UpsertProductDTOTest extends TestCase
{
    private function dto(ProductPriceType $type, ?string $optionHeading): UpsertProductDTO
    {
        return new UpsertProductDTO(
            account_id: 1,
            event_id: 1,
            product_category_id: 1,
            title: 'Course',
            type: $type,
            product_type: ProductType::TICKET,
            option_heading: $optionHeading,
        );
    }

    public function testProductWithOptionsKeepsItsHeadingTrimmed(): void
    {
        $this->assertSame('Choisis ta distance', $this->dto(ProductPriceType::SIZED, '  Choisis ta distance ')->optionHeading());
    }

    public function testHeadingIsPlainText(): void
    {
        $this->assertSame('Choisis ta distance', $this->dto(ProductPriceType::SIZED, '<b>Choisis</b> ta distance')->optionHeading());
    }

    public function testEmptyHeadingFallsBackToTheDefault(): void
    {
        $this->assertNull($this->dto(ProductPriceType::SIZED, '   ')->optionHeading());
        $this->assertNull($this->dto(ProductPriceType::SIZED, null)->optionHeading());
    }

    public function testOnlyAProductWithOptionsHasAHeading(): void
    {
        $this->assertNull($this->dto(ProductPriceType::TIERED, 'Choisis ta distance')->optionHeading());
        $this->assertNull($this->dto(ProductPriceType::PAID, 'Choisis ta distance')->optionHeading());
    }
}
