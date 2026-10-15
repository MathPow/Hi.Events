<?php

namespace Tests\Unit\Services\Domain\Order;

use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Services\Domain\Order\OrderManagementService;
use HiEvents\Services\Domain\Tax\TaxAndFeeOrderRollupService;
use Mockery as m;
use Tests\TestCase;

class OrderManagementServiceDepositTest extends TestCase
{
    private OrderRepositoryInterface $orderRepository;
    private ProductRepositoryInterface $productRepository;
    private OrderManagementService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $this->productRepository = m::mock(ProductRepositoryInterface::class);
        $rollup = m::mock(TaxAndFeeOrderRollupService::class);
        $rollup->shouldReceive('rollup')->andReturn([]);

        $this->orderRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->orderRepository->shouldReceive('findById')->andReturn(new OrderDomainObject());

        $this->service = new OrderManagementService($this->orderRepository, $rollup, $this->productRepository);
    }

    private function item(int $productId, int $quantity): OrderItemDomainObject
    {
        return (new OrderItemDomainObject())
            ->setProductId($productId)
            ->setQuantity($quantity)
            ->setTotalBeforeAdditions(50 * $quantity)
            ->setTotalTax(0)
            ->setTotalServiceFee(0)
            ->setTotalGross(50 * $quantity);
    }

    public function testDepositIsSummedPerTicketAndKeptOutOfTheTotal(): void
    {
        $this->productRepository->shouldReceive('findWhereIn')->andReturn(collect([
            (new ProductDomainObject())->setId(1)->setDepositAmount(100),
            (new ProductDomainObject())->setId(2)->setDepositAmount(null),
        ]));

        $this->orderRepository->shouldReceive('updateFromArray')
            ->once()
            ->with(9, m::on(fn(array $data) => $data['total_gross'] === 150.0
                && $data['deposit_amount'] === 200.0
                && $data['deposit_status'] === 'PENDING'))
            ->andReturn(new OrderDomainObject());

        $order = (new OrderDomainObject())->setId(9)->setPlatformContribution(0);
        $this->service->updateOrderTotals($order, collect([$this->item(1, 2), $this->item(2, 1)]));
    }

    public function testRecalculationKeepsAnAlreadyRecordedStatus(): void
    {
        $this->productRepository->shouldReceive('findWhereIn')->andReturn(collect([
            (new ProductDomainObject())->setId(1)->setDepositAmount(100),
        ]));

        $this->orderRepository->shouldReceive('updateFromArray')
            ->once()
            ->with(9, m::on(fn(array $data) => $data['deposit_status'] === 'RECEIVED'))
            ->andReturn(new OrderDomainObject());

        $order = (new OrderDomainObject())->setId(9)->setPlatformContribution(0)->setDepositStatus('RECEIVED');
        $this->service->updateOrderTotals($order, collect([$this->item(1, 1)]));
    }

    public function testOrderWithoutDepositProductsHasNoDepositFields(): void
    {
        $this->productRepository->shouldReceive('findWhereIn')->andReturn(collect([
            (new ProductDomainObject())->setId(2)->setDepositAmount(null),
        ]));

        $this->orderRepository->shouldReceive('updateFromArray')
            ->once()
            ->with(9, m::on(fn(array $data) => !array_key_exists('deposit_amount', $data)))
            ->andReturn(new OrderDomainObject());

        $order = (new OrderDomainObject())->setId(9)->setPlatformContribution(0);
        $this->service->updateOrderTotals($order, collect([$this->item(2, 1)]));
    }
}
