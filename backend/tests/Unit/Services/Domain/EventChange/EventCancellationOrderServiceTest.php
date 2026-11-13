<?php

namespace Tests\Unit\Services\Domain\EventChange;

use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\DomainObjects\Status\OrderRefundStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Mail\EventChange\EventCancelledMail;
use HiEvents\Repository\Interfaces\EventCancellationRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\DTO\RefundOrderDTO;
use HiEvents\Services\Application\Handlers\Order\Payment\Stripe\RefundOrderHandler;
use HiEvents\Services\Domain\EventChange\EventCancellationOrderService;
use HiEvents\Services\Domain\EventChange\EventOrderRefundService;
use HiEvents\Services\Domain\Order\OrderCancelService;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Database\DatabaseManager;
use Illuminate\Mail\PendingMail;
use Mockery;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Stripe\Exception\InvalidRequestException;
use Tests\TestCase;

class EventCancellationOrderServiceTest extends TestCase
{
    private OrderCancelService $orderCancelService;
    private RefundOrderHandler $refundOrderHandler;
    private EventChangeRefundRepositoryInterface $refundRepository;
    private EventCancellationOrderService $service;

    private OrderDomainObject $order;
    private bool $refundOrders = true;
    private string $recordStatus;

    /** @var array<string, mixed>|null */
    private ?array $finished = null;

    /** @var EventCancelledMail[] */
    private array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->order = $this->paidOnlineOrder();
        $this->recordStatus = EventChangeRefundStatus::PENDING->name;

        $orderRepository = Mockery::mock(OrderRepositoryInterface::class);
        $orderRepository->shouldReceive('loadRelation')->andReturnSelf();
        $orderRepository->shouldReceive('findFirstWhere')->with(['event_id' => 5, 'id' => 1])->andReturnUsing(fn() => $this->order);

        $this->orderCancelService = Mockery::mock(OrderCancelService::class);
        $this->refundOrderHandler = Mockery::mock(RefundOrderHandler::class);

        $databaseManager = Mockery::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(fn(callable $callback) => $callback());
        $databaseManager->shouldReceive('statement')->with('SELECT pg_advisory_xact_lock(hashtext(?))', ['event-change-order-1'])->andReturnTrue();

        $this->refundRepository = Mockery::mock(EventChangeRefundRepositoryInterface::class);
        $this->refundRepository->shouldReceive('findFirstWhere')->with(['id' => 11])->andReturnUsing(fn() => (new EventChangeRefundDomainObject())
            ->setId(11)
            ->setEventId(5)
            ->setOrderId(1)
            ->setEventCancellationId(4)
            ->setStatus($this->recordStatus));
        $this->refundRepository->shouldReceive('updateWhere')->andReturnUsing(function (array $attributes, array $where) {
            $this->assertSame(['id' => 11], $where);
            $this->finished = $attributes;
            return 1;
        });

        $cancellationRepository = Mockery::mock(EventCancellationRepositoryInterface::class);
        $cancellationRepository->shouldReceive('findById')->with(4)->andReturnUsing(fn() => (new EventCancellationDomainObject())
            ->setId(4)
            ->setEventId(5)
            ->setMessage('Annulé.')
            ->setRefundOrders($this->refundOrders));

        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findById')->andReturn(
            (new EventDomainObject())->setId(5)->setCurrency('CAD')->setOrganizer(new OrganizerDomainObject())->setEventSettings(new EventSettingDomainObject()),
        );

        $pending = Mockery::mock(PendingMail::class);
        $pending->shouldReceive('locale')->andReturnSelf();
        $pending->shouldReceive('send')->andReturnUsing(function ($mail) {
            $this->sent[] = $mail;
            return null;
        });
        $mailer = Mockery::mock(Mailer::class);
        $mailer->shouldReceive('to')->andReturn($pending);

        $this->service = new EventCancellationOrderService(
            eventChangeRefundRepository: $this->refundRepository,
            eventCancellationRepository: $cancellationRepository,
            eventRepository: $eventRepository,
            eventOrderRefundService: new EventOrderRefundService(
                orderRepository: $orderRepository,
                orderCancelService: $this->orderCancelService,
                refundOrderHandler: $this->refundOrderHandler,
                databaseManager: $databaseManager,
            ),
            databaseManager: $databaseManager,
            mailer: $mailer,
            logger: Mockery::mock(LoggerInterface::class)->shouldIgnoreMissing(),
        );
    }

    public function test_a_paid_order_is_cancelled_then_refunded_in_full_and_its_buyer_told(): void
    {
        $this->orderCancelService->shouldReceive('cancelOrder')->once()
            ->withArgs(fn(OrderDomainObject $order, bool $notifyBuyer) => $order->getId() === 1 && $notifyBuyer === false);
        $this->refundOrderHandler->shouldReceive('handle')->once()
            ->withArgs(fn(RefundOrderDTO $dto) => $dto->order_id === 1 && $dto->amount === 80.0 && !$dto->notify_buyer && !$dto->cancel_order);

        $status = $this->service->process(11);

        $this->assertSame(EventChangeRefundStatus::REFUNDED, $status);
        $this->assertSame(['status' => 'REFUNDED', 'amount' => 80.0, 'error' => null], $this->finished);
        $this->assertCount(1, $this->sent);
        $this->assertSame(EventChangeRefundStatus::REFUNDED, $this->sent[0]->refundStatus);
        $this->assertSame(80.0, $this->sent[0]->refundAmount);
    }

    public function test_an_already_refunded_order_is_skipped(): void
    {
        $this->order = $this->paidOnlineOrder()->setRefundStatus(OrderRefundStatus::REFUNDED->name);
        $this->orderCancelService->shouldNotReceive('cancelOrder');
        $this->refundOrderHandler->shouldNotReceive('handle');

        $this->assertSame(EventChangeRefundStatus::SKIPPED, $this->service->process(11));
        $this->assertSame('SKIPPED', $this->finished['status']);
        $this->assertSame([], $this->sent);
    }

    public function test_an_already_cancelled_order_is_skipped(): void
    {
        $this->order = $this->paidOnlineOrder()->setStatus(OrderStatus::CANCELLED->name);
        $this->orderCancelService->shouldNotReceive('cancelOrder');
        $this->refundOrderHandler->shouldNotReceive('handle');

        $this->assertSame(EventChangeRefundStatus::SKIPPED, $this->service->process(11));
    }

    public function test_a_job_that_runs_again_does_nothing(): void
    {
        $this->recordStatus = EventChangeRefundStatus::REFUNDED->name;
        $this->orderCancelService->shouldNotReceive('cancelOrder');
        $this->refundOrderHandler->shouldNotReceive('handle');
        $this->refundRepository->shouldNotReceive('updateWhere');

        $this->assertSame(EventChangeRefundStatus::REFUNDED, $this->service->process(11));
        $this->assertSame([], $this->sent);
    }

    public function test_a_failed_refund_is_recorded_and_the_order_stays_cancelled(): void
    {
        $this->orderCancelService->shouldReceive('cancelOrder')->once();
        $this->refundOrderHandler->shouldReceive('handle')->once()->andThrow(new InvalidRequestException('Insufficient balance'));

        $status = $this->service->process(11);

        $this->assertSame(EventChangeRefundStatus::FAILED, $status);
        $this->assertSame(['status' => 'FAILED', 'amount' => 80.0, 'error' => 'Insufficient balance'], $this->finished);
        $this->assertSame(EventChangeRefundStatus::FAILED, $this->sent[0]->refundStatus);
    }

    public function test_a_failed_cancellation_is_recorded(): void
    {
        $this->orderCancelService->shouldReceive('cancelOrder')->once()->andThrow(new RuntimeException('Deadlock'));
        $this->refundOrderHandler->shouldNotReceive('handle');

        $this->assertSame(EventChangeRefundStatus::FAILED, $this->service->process(11));
        $this->assertSame('FAILED', $this->finished['status']);
        $this->assertSame('Deadlock', $this->finished['error']);
    }

    public function test_without_automatic_refunds_the_order_is_only_cancelled(): void
    {
        $this->refundOrders = false;
        $this->orderCancelService->shouldReceive('cancelOrder')->once();
        $this->refundOrderHandler->shouldNotReceive('handle');

        $this->assertSame(EventChangeRefundStatus::NOT_REFUNDED, $this->service->process(11));
        $this->assertSame(EventChangeRefundStatus::NOT_REFUNDED, $this->sent[0]->refundStatus);
    }

    public function test_an_order_paid_offline_is_left_to_the_organizer(): void
    {
        $this->order = $this->paidOnlineOrder()->setPaymentProvider(PaymentProviders::OFFLINE->name)->setStripePayment(null);
        $this->orderCancelService->shouldReceive('cancelOrder')->once();
        $this->refundOrderHandler->shouldNotReceive('handle');

        $this->assertSame(EventChangeRefundStatus::MANUAL_REFUND_REQUIRED, $this->service->process(11));
    }

    public function test_a_free_order_is_cancelled_with_nothing_to_refund(): void
    {
        $this->order = $this->paidOnlineOrder()->setTotalGross(0.0)->setStripePayment(null);
        $this->orderCancelService->shouldReceive('cancelOrder')->once();
        $this->refundOrderHandler->shouldNotReceive('handle');

        $this->assertSame(EventChangeRefundStatus::CANCELLED_NO_PAYMENT, $this->service->process(11));
    }

    private function paidOnlineOrder(): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setId(1)
            ->setEventId(5)
            ->setEmail('alex@example.com')
            ->setFirstName('Alex')
            ->setLastName('Tremblay')
            ->setStatus(OrderStatus::COMPLETED->name)
            ->setCurrency('CAD')
            ->setTotalGross(80.0)
            ->setTotalRefunded(0.0)
            ->setPaymentProvider(PaymentProviders::STRIPE->name)
            ->setStripePayment((new StripePaymentDomainObject())->setId(100));
    }
}
