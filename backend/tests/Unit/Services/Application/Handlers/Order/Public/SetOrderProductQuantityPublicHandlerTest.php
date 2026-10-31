<?php

namespace Tests\Unit\Services\Application\Handlers\Order\Public;

use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrderItemDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Exceptions\UnauthorizedException;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderItemRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\DTO\ProductOrderDetailsDTO;
use HiEvents\Services\Application\Handlers\Order\Public\SetOrderProductQuantityPublicHandler;
use HiEvents\Services\Domain\Order\OrderCreateRequestValidationService;
use HiEvents\Services\Domain\Order\OrderItemProcessingService;
use HiEvents\Services\Domain\Order\OrderManagementService;
use HiEvents\Services\Domain\Product\DTO\OrderProductPriceDTO;
use HiEvents\Services\Infrastructure\Session\CheckoutSessionManagementService;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Mockery as m;
use Tests\TestCase;

class SetOrderProductQuantityPublicHandlerTest extends TestCase
{
    private SetOrderProductQuantityPublicHandler $handler;
    private OrderRepositoryInterface $orderRepository;
    private OrderItemRepositoryInterface $orderItemRepository;
    private ProductRepositoryInterface $productRepository;
    private OrderCreateRequestValidationService $validationService;
    private OrderItemProcessingService $orderItemProcessingService;
    private OrderManagementService $orderManagementService;
    private CheckoutSessionManagementService $sessionService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $this->orderRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->orderItemRepository = m::mock(OrderItemRepositoryInterface::class);
        $this->productRepository = m::mock(ProductRepositoryInterface::class);
        $this->productRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->validationService = m::mock(OrderCreateRequestValidationService::class);
        $this->orderItemProcessingService = m::mock(OrderItemProcessingService::class);
        $this->orderManagementService = m::mock(OrderManagementService::class);
        $this->sessionService = m::mock(CheckoutSessionManagementService::class);
        $this->sessionService->shouldReceive('verifySession')->with('session-ok')->andReturn(true)->byDefault();

        $eventRepository = m::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findById')->andReturn(m::mock(EventDomainObject::class));

        $promoCodeRepository = m::mock(PromoCodeRepositoryInterface::class);

        $databaseManager = m::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(static fn(callable $callback) => $callback());

        $this->handler = new SetOrderProductQuantityPublicHandler(
            $this->orderRepository,
            $this->orderItemRepository,
            $eventRepository,
            $this->productRepository,
            $promoCodeRepository,
            $this->validationService,
            $this->orderItemProcessingService,
            $this->orderManagementService,
            $this->sessionService,
            $databaseManager,
        );
    }

    public function testThrowsWhenTheOrderDoesNotExist(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn(null);

        $this->expectException(ResourceNotFoundException::class);

        $this->handler->handle(1, 'abc123', 20, 200, 1);
    }

    public function testRefusesAnotherBrowsersOrder(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->makeOrder(sessionId: 'someone-else'));
        $this->sessionService->shouldReceive('verifySession')->with('someone-else')->andReturn(false);
        $this->orderItemRepository->shouldNotReceive('deleteWhere');

        $this->expectException(UnauthorizedException::class);

        $this->handler->handle(1, 'abc123', 20, 200, 1);
    }

    public function testThrowsWhenTheReservationHasExpired(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->makeOrder(isExpired: true));
        $this->orderItemRepository->shouldNotReceive('deleteWhere');

        $this->expectException(ResourceConflictException::class);

        $this->handler->handle(1, 'abc123', 20, 200, 1);
    }

    /**
     * Le PaymentIntent est reutilise tel quel: un ajout apres l'etape du paiement ne serait
     * pas debite.
     */
    public function testRefusesOnceThePaymentHasStarted(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')
            ->andReturn($this->makeOrder(stripePayment: m::mock(StripePaymentDomainObject::class)));
        $this->orderItemRepository->shouldNotReceive('deleteWhere');

        $this->expectException(ResourceConflictException::class);

        $this->handler->handle(1, 'abc123', 20, 200, 1);
    }

    /**
     * Les coordonnees envoyees, l'acheteur peut revenir du paiement: le total ne bouge plus.
     */
    public function testRefusesOnceTheDetailsWereSent(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')
            ->andReturn($this->makeOrder(email: 'acheteur@example.com'));
        $this->orderItemRepository->shouldNotReceive('deleteWhere');

        $this->expectException(ResourceConflictException::class);

        $this->handler->handle(1, 'abc123', 20, 200, 1);
    }

    public function testRefusesATicket(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->makeOrder());
        $this->productRepository->shouldReceive('findFirstWhere')
            ->andReturn($this->makeProduct(productType: ProductType::TICKET->name));
        $this->orderItemRepository->shouldNotReceive('deleteWhere');

        $this->expectException(ValidationException::class);

        $this->handler->handle(1, 'abc123', 20, 200, 1);
    }

    public function testAddsTheMerchBesideTheTickets(): void
    {
        $order = $this->makeOrder(orderItems: new Collection([
            $this->makeOrderItem(productId: 5, priceId: 50, quantity: 2, price: 30.00),
        ]));

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->productRepository->shouldReceive('findFirstWhere')->andReturn($this->makeProduct());

        // Seul l'ajout passe par les verifications de stock: la commande reserve deja le reste.
        $this->validationService->shouldReceive('validateRequestData')->once()->with(1, [
            'products' => [[
                'product_id' => 20,
                'quantities' => [['price_id' => 200, 'quantity' => 1]],
            ]],
        ]);

        $this->orderItemRepository->shouldReceive('deleteWhere')->once()->with(['order_id' => 10]);
        $this->orderItemProcessingService->shouldReceive('process')->once()
            ->withArgs(function ($passedOrder, Collection $details) {
                $this->assertSame([5, 20], $details->map(fn(ProductOrderDetailsDTO $detail) => $detail->product_id)->all());
                $this->assertSame(2, $details->first()->quantities->first()->quantity);
                $this->assertSame(30.00, $details->first()->quantities->first()->price);
                /** @var OrderProductPriceDTO $merch */
                $merch = $details->last()->quantities->first();
                $this->assertSame([200, 1], [$merch->price_id, $merch->quantity]);

                return true;
            })
            ->andReturn(new Collection());
        $this->orderManagementService->shouldReceive('updateOrderTotals')->once()->andReturn($order);

        $this->handler->handle(1, 'abc123', 20, 200, 1);
    }

    /**
     * Les fiches du formulaire de la caisse suivent l'ordre des lignes: une ligne changee reste
     * a sa place, devant les billets si elle y etait.
     */
    public function testAChangedLineKeepsItsPlace(): void
    {
        $order = $this->makeOrder(orderItems: new Collection([
            $this->makeOrderItem(productId: 20, priceId: 200, quantity: 1, price: 8.00),
            $this->makeOrderItem(productId: 5, priceId: 50, quantity: 1, price: 30.00),
        ]));

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->productRepository->shouldReceive('findFirstWhere')->andReturn($this->makeProduct());
        $this->validationService->shouldReceive('validateRequestData')->once()
            ->withArgs(fn(int $eventId, array $data) => $data['products'][0]['quantities'][0]['quantity'] === 2);

        $this->orderItemRepository->shouldReceive('deleteWhere')->once();
        $this->orderItemProcessingService->shouldReceive('process')->once()
            ->withArgs(function ($passedOrder, Collection $details) {
                $this->assertSame([20, 5], $details->map(fn(ProductOrderDetailsDTO $detail) => $detail->product_id)->all());
                $this->assertSame(3, $details->first()->quantities->first()->quantity);

                return true;
            })
            ->andReturn(new Collection());
        $this->orderManagementService->shouldReceive('updateOrderTotals')->once()->andReturn($order);

        $this->handler->handle(1, 'abc123', 20, 200, 3);
    }

    public function testZeroRemovesTheMerchWithoutAStockCheck(): void
    {
        $order = $this->makeOrder(orderItems: new Collection([
            $this->makeOrderItem(productId: 5, priceId: 50, quantity: 1, price: 30.00),
            $this->makeOrderItem(productId: 20, priceId: 200, quantity: 2, price: 8.00),
        ]));

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->productRepository->shouldReceive('findFirstWhere')->andReturn($this->makeProduct());
        $this->validationService->shouldNotReceive('validateRequestData');

        $this->orderItemRepository->shouldReceive('deleteWhere')->once();
        $this->orderItemProcessingService->shouldReceive('process')->once()
            ->withArgs(function ($passedOrder, Collection $details) {
                $this->assertSame([5], $details->map(fn(ProductOrderDetailsDTO $detail) => $detail->product_id)->all());

                return true;
            })
            ->andReturn(new Collection());
        $this->orderManagementService->shouldReceive('updateOrderTotals')->once()->andReturn($order);

        $this->handler->handle(1, 'abc123', 20, 200, 0);
    }

    public function testTheMaximumPerOrderCountsWhatTheOrderAlreadyHolds(): void
    {
        $order = $this->makeOrder(orderItems: new Collection([
            $this->makeOrderItem(productId: 20, priceId: 201, quantity: 2, price: 35.00),
        ]));

        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($order);
        $this->productRepository->shouldReceive('findFirstWhere')->andReturn($this->makeProduct(maxPerOrder: 2));
        $this->validationService->shouldReceive('validateRequestData')->once();
        $this->orderItemRepository->shouldNotReceive('deleteWhere');

        $this->expectException(ValidationException::class);

        $this->handler->handle(1, 'abc123', 20, 200, 1);
    }

    private function makeOrder(
        bool                       $isExpired = false,
        string                     $sessionId = 'session-ok',
        ?StripePaymentDomainObject $stripePayment = null,
        ?Collection                $orderItems = null,
        ?string                    $email = null,
    ): OrderDomainObject
    {
        $order = m::mock(OrderDomainObject::class);
        $order->shouldReceive('getId')->andReturn(10);
        $order->shouldReceive('getSessionId')->andReturn($sessionId);
        $order->shouldReceive('isOrderReserved')->andReturn(true);
        $order->shouldReceive('isReservedOrderExpired')->andReturn($isExpired);
        $order->shouldReceive('getStripePayment')->andReturn($stripePayment);
        $order->shouldReceive('getEmail')->andReturn($email);
        $order->shouldReceive('getPaymentStatus')->andReturn($email === null ? null : 'AWAITING_PAYMENT');
        $order->shouldReceive('getPromoCodeId')->andReturn(null);
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

    private function makeProduct(string $productType = 'GENERAL', ?int $maxPerOrder = null): ProductDomainObject
    {
        $prices = (new Collection([200, 201]))->map(function (int $id) {
            $price = m::mock(ProductPriceDomainObject::class);
            $price->shouldReceive('getId')->andReturn($id);

            return $price;
        });

        $product = m::mock(ProductDomainObject::class);
        $product->shouldReceive('getId')->andReturn(20);
        $product->shouldReceive('getTitle')->andReturn('Casquette');
        $product->shouldReceive('getProductType')->andReturn($productType);
        $product->shouldReceive('isDonationType')->andReturn(false);
        $product->shouldReceive('getProductPrices')->andReturn($prices);
        $product->shouldReceive('getMaxPerOrder')->andReturn($maxPerOrder);

        return $product;
    }
}
