<?php

namespace Tests\Unit\Services\Application\Handlers\Order\Public;

use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\Public\SetPlatformContributionHandler;
use HiEvents\Services\Domain\Order\OrderManagementService;
use Illuminate\Support\Collection;
use Mockery as m;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Tests\TestCase;

class SetPlatformContributionHandlerTest extends TestCase
{
    private SetPlatformContributionHandler $handler;
    private OrderRepositoryInterface $orderRepository;
    private OrderManagementService $orderManagementService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $this->orderRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->orderManagementService = m::mock(OrderManagementService::class);

        $this->handler = new SetPlatformContributionHandler(
            $this->orderRepository,
            $this->orderManagementService,
        );
    }

    public function testThrowsWhenTheOrderDoesNotExist(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn(null);

        $this->expectException(ResourceNotFoundException::class);

        $this->handler->handle(1, 'abc123', 5.00);
    }

    /**
     * Sans ce garde, un appel tardif gonflerait le total d'une commande deja encaissee
     * et la facture ne correspondrait plus au montant debite.
     */
    public function testThrowsWhenTheOrderIsNoLongerReserved(): void
    {
        $this->orderRepository
            ->shouldReceive('findFirstWhere')
            ->andReturn($this->makeOrder(OrderStatus::COMPLETED));

        $this->expectException(ResourceConflictException::class);

        $this->handler->handle(1, 'abc123', 5.00);
    }

    public function testStoresTheRoundedContributionAndRecalculatesTheTotals(): void
    {
        $order = $this->makeOrder(OrderStatus::RESERVED);

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->orderRepository->shouldReceive('findById')->with(10)->andReturn($order);

        $this->orderRepository
            ->shouldReceive('updateFromArray')
            ->once()
            ->with(10, ['platform_contribution' => 5.13])
            ->andReturn($order);

        $this->orderManagementService
            ->shouldReceive('updateOrderTotals')
            ->once()
            ->andReturn($order);

        $this->handler->handle(1, 'abc123', 5.129);
    }

    public function testClampsANegativeContributionToZero(): void
    {
        $order = $this->makeOrder(OrderStatus::RESERVED);

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->orderRepository->shouldReceive('findById')->with(10)->andReturn($order);

        $this->orderRepository
            ->shouldReceive('updateFromArray')
            ->once()
            ->with(10, ['platform_contribution' => 0.0])
            ->andReturn($order);

        $this->orderManagementService
            ->shouldReceive('updateOrderTotals')
            ->once()
            ->andReturn($order);

        $this->handler->handle(1, 'abc123', -20.00);
    }

    /**
     * L'endpoint est public: sans ce garde, n'importe qui pourrait rendre payante
     * une commande gratuite, qui serait ensuite completee sans encaissement.
     */
    public function testThrowsWhenTheOrderIsFree(): void
    {
        $this->orderRepository
            ->shouldReceive('findFirstWhere')
            ->andReturn($this->makeOrder(OrderStatus::RESERVED, isPaymentRequired: false));

        $this->orderRepository->shouldNotReceive('updateFromArray');

        $this->expectException(ResourceConflictException::class);

        $this->handler->handle(1, 'abc123', 5.00);
    }

    private function makeOrder(OrderStatus $status, bool $isPaymentRequired = true): OrderDomainObject
    {
        $order = m::mock(OrderDomainObject::class);
        $order->shouldReceive('getId')->andReturn(10);
        $order->shouldReceive('getStatus')->andReturn($status->name);
        $order->shouldReceive('isPaymentRequired')->andReturn($isPaymentRequired);
        $order->shouldReceive('getOrderItems')->andReturn(new Collection());

        return $order;
    }
}
