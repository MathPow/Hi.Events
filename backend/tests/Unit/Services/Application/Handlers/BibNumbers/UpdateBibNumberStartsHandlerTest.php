<?php

namespace Tests\Unit\Services\Application\Handlers\BibNumbers;

use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\Exceptions\InvalidProductPriceId;
use HiEvents\Repository\Interfaces\ProductPriceRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Services\Application\Handlers\BibNumbers\UpdateBibNumberStartsHandler;
use Illuminate\Support\Collection;
use Mockery as m;
use Tests\TestCase;

class UpdateBibNumberStartsHandlerTest extends TestCase
{
    private ProductRepositoryInterface $productRepository;
    private ProductPriceRepositoryInterface $productPriceRepository;
    private UpdateBibNumberStartsHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->productRepository = m::mock(ProductRepositoryInterface::class);
        $this->productPriceRepository = m::mock(ProductPriceRepositoryInterface::class);

        $this->productRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->productRepository->shouldReceive('findWhere')
            ->once()
            ->with(['event_id' => 7, 'product_type' => 'TICKET'])
            ->andReturn(new Collection([
                (new ProductDomainObject())->setId(1)->setProductPrices(new Collection([
                    (new ProductPriceDomainObject())->setId(10),
                    (new ProductPriceDomainObject())->setId(11),
                ])),
            ]));

        $this->handler = new UpdateBibNumberStartsHandler($this->productRepository, $this->productPriceRepository);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    public function testSavesTheFirstNumberOfEachOption(): void
    {
        $saved = [];
        $this->productPriceRepository->shouldReceive('updateWhere')
            ->twice()
            ->andReturnUsing(function (array $attributes, array $where) use (&$saved) {
                $saved[$where['id']] = $attributes['bib_number_start'];
                return 1;
            });

        $this->handler->handle(7, [10 => 1, 11 => null]);

        $this->assertSame([10 => 1, 11 => null], $saved);
    }

    public function testRefusesAnOptionOfAnotherEvent(): void
    {
        $this->productPriceRepository->shouldNotReceive('updateWhere');

        $this->expectException(InvalidProductPriceId::class);

        $this->handler->handle(7, [10 => 1, 99 => 500]);
    }
}
