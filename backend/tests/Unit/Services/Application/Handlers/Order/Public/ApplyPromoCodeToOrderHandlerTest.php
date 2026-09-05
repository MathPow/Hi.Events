<?php

namespace Tests\Unit\Services\Application\Handlers\Order\Public;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\Exceptions\InvalidPromoCodeException;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderItemRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\DTO\ProductOrderDetailsDTO;
use HiEvents\Services\Application\Handlers\Order\Public\ApplyPromoCodeToOrderHandler;
use HiEvents\Services\Domain\Order\OrderItemProcessingService;
use HiEvents\Services\Domain\Order\OrderManagementService;
use HiEvents\Services\Domain\Product\DTO\OrderProductPriceDTO;
use HiEvents\Services\Domain\PromoCode\PromoCodeUsageValidationService;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Mockery as m;
use Tests\TestCase;

class ApplyPromoCodeToOrderHandlerTest extends TestCase
{
    private ApplyPromoCodeToOrderHandler $handler;
    private OrderRepositoryInterface $orderRepository;
    private OrderItemRepositoryInterface $orderItemRepository;
    private PromoCodeRepositoryInterface $promoCodeRepository;
    private PromoCodeUsageValidationService $promoCodeUsageValidationService;
    private OrderItemProcessingService $orderItemProcessingService;
    private OrderManagementService $orderManagementService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $this->orderRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->orderItemRepository = m::mock(OrderItemRepositoryInterface::class);
        $this->promoCodeRepository = m::mock(PromoCodeRepositoryInterface::class);
        $this->promoCodeUsageValidationService = m::mock(PromoCodeUsageValidationService::class);
        $this->orderItemProcessingService = m::mock(OrderItemProcessingService::class);
        $this->orderManagementService = m::mock(OrderManagementService::class);

        $eventRepository = m::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findById')->andReturn(m::mock(EventDomainObject::class));

        $databaseManager = m::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(static fn(callable $callback) => $callback());

        $this->handler = new ApplyPromoCodeToOrderHandler(
            $this->orderRepository,
            $this->orderItemRepository,
            $eventRepository,
            $this->promoCodeRepository,
            $this->promoCodeUsageValidationService,
            $this->orderItemProcessingService,
            $this->orderManagementService,
            $databaseManager,
        );
    }

    public function testThrowsWhenTheOrderDoesNotExist(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn(null);

        $this->expectException(ResourceNotFoundException::class);

        $this->handler->handle(1, 'abc123', 'SUMMER');
    }

    /**
     * Les lignes d'une commande deja encaissee sont le justificatif du montant debite:
     * les recalculer ferait diverger la facture du paiement.
     */
    public function testThrowsWhenTheOrderIsNoLongerReserved(): void
    {
        $this->orderRepository
            ->shouldReceive('findFirstWhere')
            ->andReturn($this->makeOrder(isReserved: false));

        $this->orderItemRepository->shouldNotReceive('deleteWhere');

        $this->expectException(ResourceConflictException::class);

        $this->handler->handle(1, 'abc123', 'SUMMER');
    }

    public function testThrowsWhenTheReservationHasExpired(): void
    {
        $this->orderRepository
            ->shouldReceive('findFirstWhere')
            ->andReturn($this->makeOrder(isExpired: true));

        $this->orderItemRepository->shouldNotReceive('deleteWhere');

        $this->expectException(ResourceConflictException::class);

        $this->handler->handle(1, 'abc123', 'SUMMER');
    }

    public function testThrowsWhenThePromoCodeIsNotUsable(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->makeOrder());
        $this->promoCodeRepository->shouldReceive('findFirstWhere')->andReturn(null);
        $this->promoCodeUsageValidationService->shouldReceive('isPromoCodeUsable')->andReturn(false);

        $this->orderItemRepository->shouldNotReceive('deleteWhere');

        $this->expectException(InvalidPromoCodeException::class);

        $this->handler->handle(1, 'abc123', 'NOPE');
    }

    public function testRebuildsTheOrderItemsWithTheDiscountedPrices(): void
    {
        $order = $this->makeOrder(orderItems: new Collection([
            $this->makeOrderItem(productId: 5, priceId: 50, quantity: 2, price: 30.00),
            $this->makeOrderItem(productId: 5, priceId: 51, quantity: 1, price: 45.00),
            $this->makeOrderItem(productId: 6, priceId: 60, quantity: 3, price: 10.00),
        ]));
        $promoCode = $this->makePromoCode();

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->orderRepository->shouldReceive('findById')->with(10)->andReturn($order);
        $this->promoCodeRepository->shouldReceive('findFirstWhere')->andReturn($promoCode);
        $this->promoCodeUsageValidationService->shouldReceive('isPromoCodeUsable')->andReturn(true);

        $this->orderItemRepository
            ->shouldReceive('deleteWhere')
            ->once()
            ->with(['order_id' => 10]);

        $this->orderItemProcessingService
            ->shouldReceive('process')
            ->once()
            ->withArgs(function ($passedOrder, Collection $productsOrderDetails, $event, $passedPromoCode) use ($promoCode) {
                $this->assertSame($promoCode, $passedPromoCode);
                $this->assertCount(2, $productsOrderDetails);

                /** @var ProductOrderDetailsDTO $firstProduct */
                $firstProduct = $productsOrderDetails->first();
                $this->assertSame(5, $firstProduct->product_id);
                $this->assertSame([50, 51], $firstProduct->quantities
                    ->map(fn(OrderProductPriceDTO $price) => $price->price_id)->all());
                $this->assertSame([2, 1], $firstProduct->quantities
                    ->map(fn(OrderProductPriceDTO $price) => $price->quantity)->all());

                return true;
            })
            ->andReturn(new Collection());

        $this->orderRepository
            ->shouldReceive('updateFromArray')
            ->once()
            ->with(10, ['promo_code_id' => 99, 'promo_code' => 'summer'])
            ->andReturn($order);

        $this->orderManagementService
            ->shouldReceive('updateOrderTotals')
            ->once()
            ->andReturn($order);

        $this->handler->handle(1, 'abc123', 'SUMMER');
    }

    /**
     * Sans ce chemin, l'acheteur qui s'est trompe de code resterait coince avec une
     * remise qu'il ne peut plus retirer avant de payer.
     */
    public function testANullCodeClearsTheDiscount(): void
    {
        $order = $this->makeOrder(orderItems: new Collection([
            $this->makeOrderItem(productId: 5, priceId: 50, quantity: 1, price: 30.00),
        ]));

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->orderRepository->shouldReceive('findById')->with(10)->andReturn($order);
        $this->promoCodeRepository->shouldNotReceive('findFirstWhere');

        $this->orderItemRepository->shouldReceive('deleteWhere')->once();

        $this->orderItemProcessingService
            ->shouldReceive('process')
            ->once()
            ->withArgs(fn($passedOrder, $productsOrderDetails, $event, $passedPromoCode) => $passedPromoCode === null)
            ->andReturn(new Collection());

        $this->orderRepository
            ->shouldReceive('updateFromArray')
            ->once()
            ->with(10, ['promo_code_id' => null, 'promo_code' => null])
            ->andReturn($order);

        $this->orderManagementService->shouldReceive('updateOrderTotals')->once()->andReturn($order);

        $this->handler->handle(1, 'abc123', null);
    }

    /**
     * La reservation se compte elle-meme dans le quota du code: sans cette sortie,
     * rejouer le code deja porte par la commande echouerait sur sa derniere unite.
     */
    public function testReapplyingTheCodeTheOrderAlreadyHoldsSkipsTheUsageCheck(): void
    {
        $order = $this->makeOrder(promoCodeId: 99, orderItems: new Collection([
            $this->makeOrderItem(productId: 5, priceId: 50, quantity: 1, price: 30.00),
        ]));

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->orderRepository->shouldReceive('findById')->with(10)->andReturn($order);
        $this->promoCodeRepository->shouldReceive('findFirstWhere')->andReturn($this->makePromoCode());
        $this->promoCodeUsageValidationService->shouldNotReceive('isPromoCodeUsable');

        $this->orderItemRepository->shouldReceive('deleteWhere')->once();
        $this->orderItemProcessingService->shouldReceive('process')->once()->andReturn(new Collection());
        $this->orderRepository->shouldReceive('updateFromArray')->once()->andReturn($order);
        $this->orderManagementService->shouldReceive('updateOrderTotals')->once()->andReturn($order);

        $this->handler->handle(1, 'abc123', 'SUMMER');
    }

    /**
     * Le montant d'un don est choisi par l'acheteur, pas derive du produit: le recalcul
     * doit le rejouer sinon il retombe au minimum configure.
     */
    public function testTheChosenDonationAmountSurvivesTheRecalculation(): void
    {
        $order = $this->makeOrder(orderItems: new Collection([
            $this->makeOrderItem(productId: 7, priceId: 70, quantity: 1, price: 75.00),
        ]));

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->orderRepository->shouldReceive('findById')->with(10)->andReturn($order);
        $this->promoCodeRepository->shouldReceive('findFirstWhere')->andReturn($this->makePromoCode());
        $this->promoCodeUsageValidationService->shouldReceive('isPromoCodeUsable')->andReturn(true);
        $this->orderItemRepository->shouldReceive('deleteWhere')->once();

        $this->orderItemProcessingService
            ->shouldReceive('process')
            ->once()
            ->withArgs(function ($passedOrder, Collection $productsOrderDetails) {
                $this->assertSame(75.00, $productsOrderDetails->first()->quantities->first()->price);

                return true;
            })
            ->andReturn(new Collection());

        $this->orderRepository->shouldReceive('updateFromArray')->once()->andReturn($order);
        $this->orderManagementService->shouldReceive('updateOrderTotals')->once()->andReturn($order);

        $this->handler->handle(1, 'abc123', 'SUMMER');
    }

    private function makeOrder(
        bool        $isReserved = true,
        bool        $isExpired = false,
        ?int        $promoCodeId = null,
        ?Collection $orderItems = null,
    ): OrderDomainObject
    {
        $order = m::mock(OrderDomainObject::class);
        $order->shouldReceive('getId')->andReturn(10);
        $order->shouldReceive('isOrderReserved')->andReturn($isReserved);
        $order->shouldReceive('isReservedOrderExpired')->andReturn($isExpired);
        $order->shouldReceive('getPromoCodeId')->andReturn($promoCodeId);
        $order->shouldReceive('getOrderItems')->andReturn($orderItems ?? new Collection());

        return $order;
    }

    private function makeOrderItem(int $productId, int $priceId, int $quantity, float $price): OrderItemDomainObject
    {
        $orderItem = m::mock(OrderItemDomainObject::class);
        $orderItem->shouldReceive('getProductId')->andReturn($productId);
        $orderItem->shouldReceive('getProductPriceId')->andReturn($priceId);
        $orderItem->shouldReceive('getQuantity')->andReturn($quantity);
        $orderItem->shouldReceive('getPriceBeforeDiscount')->andReturn(null);
        $orderItem->shouldReceive('getPrice')->andReturn($price);

        return $orderItem;
    }

    private function makePromoCode(): PromoCodeDomainObject
    {
        $promoCode = m::mock(PromoCodeDomainObject::class);
        $promoCode->shouldReceive('getId')->andReturn(99);
        $promoCode->shouldReceive('getCode')->andReturn('summer');

        return $promoCode;
    }
}
