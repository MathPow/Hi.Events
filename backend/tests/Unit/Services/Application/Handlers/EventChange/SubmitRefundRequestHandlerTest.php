<?php

namespace Tests\Unit\Services\Application\Handlers\EventChange;

use Carbon\Carbon;
use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Exceptions\RefundRequestNotAllowedException;
use HiEvents\Mail\EventChange\ManualRefundRequiredMail;
use HiEvents\Repository\Interfaces\AttendeeCheckInRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestDTO;
use HiEvents\Services\Application\Handlers\EventChange\RefundRequestViewFactory;
use HiEvents\Services\Application\Handlers\EventChange\SubmitRefundRequestHandler;
use HiEvents\Services\Application\Handlers\Order\DTO\RefundOrderDTO;
use HiEvents\Services\Application\Handlers\Order\Payment\Stripe\RefundOrderHandler;
use HiEvents\Services\Domain\EventChange\Enums\RefundRequestRefusal;
use HiEvents\Services\Domain\EventChange\EventOrderRefundService;
use HiEvents\Services\Domain\EventChange\RefundRequestService;
use HiEvents\Services\Domain\EventChange\RefundRequestTokenService;
use HiEvents\Services\Domain\Order\OrderCancelService;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Database\DatabaseManager;
use Illuminate\Mail\PendingMail;
use Mockery;
use Stripe\Exception\InvalidRequestException;
use Tests\TestCase;

class SubmitRefundRequestHandlerTest extends TestCase
{
    private OrderCancelService $orderCancelService;
    private RefundOrderHandler $refundOrderHandler;
    private EventChangeRefundRepositoryInterface $refundRepository;
    private Mailer $mailer;
    private SubmitRefundRequestHandler $handler;

    private OrderDomainObject $order;
    private bool $cancelled = false;

    /** @var string[] */
    private array $statements = [];

    /** @var array<int, array> */
    private array $records = [];

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-12 12:00:00', 'UTC'));
        config(['app.key' => 'base64:test-key']);

        $this->order = $this->paidOnlineOrder();

        // The database: the order as it is now, cancelled once cancelOrder() ran.
        $orderRepository = Mockery::mock(OrderRepositoryInterface::class);
        $orderRepository->shouldReceive('loadRelation')->andReturnSelf();
        $orderRepository->shouldReceive('findFirstWhere')->andReturnUsing(fn() => $this->cancelled
            ? (clone $this->order)->setStatus(OrderStatus::CANCELLED->name)
            : clone $this->order);

        $this->orderCancelService = Mockery::mock(OrderCancelService::class);
        $this->orderCancelService->shouldReceive('cancelOrder')->andReturnUsing(function () {
            $this->cancelled = true;
        })->byDefault();

        $this->refundOrderHandler = Mockery::mock(RefundOrderHandler::class);

        $databaseManager = Mockery::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(fn(callable $callback) => $callback());
        $databaseManager->shouldReceive('statement')->andReturnUsing(function (string $query, array $bindings) {
            $this->statements[] = $bindings[0];
            return true;
        });

        $eventOrderRefundService = new EventOrderRefundService(
            orderRepository: $orderRepository,
            orderCancelService: $this->orderCancelService,
            refundOrderHandler: $this->refundOrderHandler,
            databaseManager: $databaseManager,
        );

        $dateChangeRepository = Mockery::mock(EventDateChangeRepositoryInterface::class);
        $dateChangeRepository->shouldReceive('findFirstWhere')->andReturn(
            (new EventDateChangeDomainObject())
                ->setId(7)
                ->setEventId(5)
                ->setOldStartDate('2026-11-14 14:00:00')
                ->setRefundsAllowed(true)
                ->setRefundDeadline('2026-11-19 14:00:00'),
        );
        $dateChangeRepository->shouldReceive('findWhere')->andReturn(collect([(new EventDateChangeDomainObject())->setId(7)]));

        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findById')->andReturn(
            (new EventDomainObject())
                ->setId(5)
                ->setTitle('Trail du Mont')
                ->setStartDate('2026-11-21 14:00:00')
                ->setTimezone('America/Toronto')
                ->setOrganizer((new OrganizerDomainObject())->setName('Club Dehors')->setEmail('club@example.com'))
                ->setEventSettings(new EventSettingDomainObject()),
        );

        $checkInRepository = Mockery::mock(AttendeeCheckInRepositoryInterface::class);
        $checkInRepository->shouldReceive('findFirstWhere')->andReturnNull();

        $this->refundRepository = Mockery::mock(EventChangeRefundRepositoryInterface::class);
        $this->refundRepository->shouldReceive('findFirstWhere')->andReturnNull();
        $this->refundRepository->shouldReceive('create')->andReturnUsing(function (array $attributes) {
            $this->records[] = $attributes;
            return new EventChangeRefundDomainObject();
        });

        $this->mailer = Mockery::mock(Mailer::class);

        $this->handler = new SubmitRefundRequestHandler(
            refundRequestService: new RefundRequestService(
                eventRepository: $eventRepository,
                eventDateChangeRepository: $dateChangeRepository,
                eventChangeRefundRepository: $this->refundRepository,
                attendeeCheckInRepository: $checkInRepository,
                eventOrderRefundService: $eventOrderRefundService,
                tokenService: new RefundRequestTokenService(app('config')),
            ),
            eventOrderRefundService: $eventOrderRefundService,
            eventChangeRefundRepository: $this->refundRepository,
            viewFactory: new RefundRequestViewFactory($eventOrderRefundService),
            databaseManager: $databaseManager,
            mailer: $this->mailer,
        );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_a_paid_order_is_cancelled_and_fully_refunded_through_the_order_refund(): void
    {
        $this->orderCancelService->shouldReceive('cancelOrder')
            ->once()
            ->withArgs(fn(OrderDomainObject $order, bool $notifyBuyer) => $order->getId() === 1 && $notifyBuyer === false)
            ->andReturnUsing(fn() => $this->cancelled = true);
        $this->refundOrderHandler->shouldReceive('handle')
            ->once()
            ->withArgs(fn(RefundOrderDTO $dto) => $dto->order_id === 1
                && $dto->event_id === 5
                && $dto->amount === 45.0
                && $dto->notify_buyer === true
                && $dto->cancel_order === false);

        $view = $this->handler->handle($this->dto());

        $this->assertSame(EventChangeRefundStatus::REFUNDED->name, $view->outcome);
        $this->assertSame(45.0, $view->refundable_amount);
        $this->assertSame('event-change-order-1', $this->statements[0]);
        $this->assertSame([[
            'event_id' => 5,
            'order_id' => 1,
            'event_date_change_id' => 7,
            'status' => EventChangeRefundStatus::REFUNDED->name,
            'amount' => 45.0,
            'currency' => 'CAD',
        ]], $this->records);
    }

    public function test_a_second_request_finds_the_order_cancelled_and_refunds_nothing(): void
    {
        $this->refundOrderHandler->shouldReceive('handle')->once();

        $this->handler->handle($this->dto());

        try {
            $this->handler->handle($this->dto());
            $this->fail('The second request must be refused');
        } catch (RefundRequestNotAllowedException $exception) {
            $this->assertSame(RefundRequestRefusal::ALREADY_CANCELLED, $exception->refusal);
        }

        $this->assertCount(1, $this->records);
    }

    public function test_a_stripe_error_cancels_nothing(): void
    {
        $this->refundOrderHandler->shouldReceive('handle')->once()->andThrow(new InvalidRequestException('Insufficient funds'));

        $this->expectException(InvalidRequestException::class);

        try {
            $this->handler->handle($this->dto());
        } finally {
            // Thrown inside the transaction: the cancellation is rolled back with it.
            $this->assertSame([], $this->records);
        }
    }

    public function test_an_order_paid_offline_is_cancelled_and_left_to_the_organizer(): void
    {
        $this->order = $this->paidOnlineOrder()->setPaymentProvider(PaymentProviders::OFFLINE->name)->setStripePayment(null);
        $this->refundOrderHandler->shouldNotReceive('handle');

        $sent = [];
        $pending = Mockery::mock(PendingMail::class);
        $pending->shouldReceive('send')->andReturnUsing(function ($mail) use (&$sent) {
            $sent[] = $mail;
            return null;
        });
        $this->mailer->shouldReceive('to')->with('club@example.com')->once()->andReturn($pending);

        $view = $this->handler->handle($this->dto());

        $this->assertSame(EventChangeRefundStatus::MANUAL_REFUND_REQUIRED->name, $view->outcome);
        $this->assertSame('OFFLINE', $view->refund_method);
        $this->assertInstanceOf(ManualRefundRequiredMail::class, $sent[0]);
        $this->assertSame(45.0, $sent[0]->amount);
    }

    public function test_a_free_order_is_just_cancelled(): void
    {
        $this->order = $this->paidOnlineOrder()->setTotalGross(0.0)->setPaymentProvider(null)->setStripePayment(null);
        $this->refundOrderHandler->shouldNotReceive('handle');
        $this->orderCancelService->shouldReceive('cancelOrder')
            ->once()
            ->withArgs(fn(OrderDomainObject $order, bool $notifyBuyer) => $notifyBuyer === true)
            ->andReturnUsing(fn() => $this->cancelled = true);

        $view = $this->handler->handle($this->dto());

        $this->assertSame(EventChangeRefundStatus::CANCELLED_NO_PAYMENT->name, $view->outcome);
        $this->assertSame(0.0, $this->records[0]['amount']);
    }

    private function dto(): RefundRequestDTO
    {
        return new RefundRequestDTO(
            eventId: 5,
            orderShortId: 'ORD1',
            dateChangeId: 7,
            token: (new RefundRequestTokenService(app('config')))->token(1, 7),
        );
    }

    private function paidOnlineOrder(): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setId(1)
            ->setEventId(5)
            ->setShortId('ORD1')
            ->setPublicId('O-1')
            ->setEmail('alex@example.com')
            ->setFirstName('Alex')
            ->setLastName('Tremblay')
            ->setStatus(OrderStatus::COMPLETED->name)
            ->setCurrency('CAD')
            ->setTotalGross(50.0)
            ->setTotalRefunded(5.0)
            ->setPaymentProvider(PaymentProviders::STRIPE->name)
            ->setStripePayment((new StripePaymentDomainObject())->setId(100));
    }
}
