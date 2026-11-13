<?php

namespace Tests\Unit\Services\Application\Handlers\EventChange;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Repository\Interfaces\EventCancellationRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\GetEventChangeStatusHandler;
use HiEvents\Services\Application\Handlers\Order\Payment\Stripe\RefundOrderHandler;
use HiEvents\Services\Domain\EventChange\DTO\EventChangeRecipientsDTO;
use HiEvents\Services\Domain\EventChange\EventChangeRecipientService;
use HiEvents\Services\Domain\EventChange\EventOrderRefundService;
use HiEvents\Services\Domain\Order\OrderCancelService;
use Illuminate\Database\DatabaseManager;
use Mockery;
use Tests\TestCase;

class GetEventChangeStatusHandlerTest extends TestCase
{
    public function test_a_cancelled_event_shows_its_progress_and_the_orders_to_refund_by_hand(): void
    {
        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('findById')->with(5)->andReturn((new EventDomainObject())->setId(5)->setCancelledAt('2026-11-12 12:00:00'));

        $recipientService = Mockery::mock(EventChangeRecipientService::class);
        $recipientService->shouldReceive('forEvent')->andReturn(new EventChangeRecipientsDTO(orders: collect(), attendees: collect()));

        $dateChangeRepository = Mockery::mock(EventDateChangeRepositoryInterface::class);
        $dateChangeRepository->shouldReceive('findWhere')->andReturn(collect());

        $cancellationRepository = Mockery::mock(EventCancellationRepositoryInterface::class);
        $cancellationRepository->shouldReceive('findFirstWhere')->andReturn(
            (new EventCancellationDomainObject())->setId(4)->setRefundOrders(true)->setRecipientsCount(3)->setCreatedAt('2026-11-12 12:00:00'),
        );

        $refundRepository = Mockery::mock(EventChangeRefundRepositoryInterface::class);
        $refundRepository->shouldReceive('findWhere')->andReturn(collect([
            (new EventChangeRefundDomainObject())->setId(1)->setOrderId(11)->setEventCancellationId(4)->setStatus('REFUNDED')->setAmount(40.0),
            (new EventChangeRefundDomainObject())->setId(2)->setOrderId(12)->setEventCancellationId(4)->setStatus('FAILED')->setAmount(25.0)->setError('Insufficient funds')->setCurrency('CAD'),
            (new EventChangeRefundDomainObject())->setId(3)->setOrderId(13)->setEventCancellationId(4)->setStatus('MANUAL_REFUND_REQUIRED')->setAmount(30.0)->setCurrency('CAD'),
        ]));

        $orderRepository = Mockery::mock(OrderRepositoryInterface::class);
        $orderRepository->shouldReceive('findWhereIn')->with('id', [12, 13])->andReturn(collect([
            (new OrderDomainObject())->setId(12)->setPublicId('O-12')->setFirstName('Alex')->setLastName('T')->setEmail('alex@example.com')->setCurrency('CAD'),
            (new OrderDomainObject())->setId(13)->setPublicId('O-13')->setFirstName('Sam')->setLastName('L')->setEmail('sam@example.com')->setCurrency('CAD'),
        ]));

        $status = (new GetEventChangeStatusHandler(
            $eventRepository,
            $dateChangeRepository,
            $cancellationRepository,
            $refundRepository,
            $orderRepository,
            $recipientService,
            new EventOrderRefundService(
                Mockery::mock(OrderRepositoryInterface::class),
                Mockery::mock(OrderCancelService::class),
                Mockery::mock(RefundOrderHandler::class),
                Mockery::mock(DatabaseManager::class),
            ),
        ))->handle(5);

        $this->assertSame('2026-11-12 12:00:00', $status->cancelled_at);
        $this->assertSame(1, $status->cancellation['counts']['REFUNDED']);
        $this->assertSame(1, $status->cancellation['counts']['FAILED']);
        $this->assertSame(0, $status->cancellation['counts']['PENDING']);
        $this->assertSame(['O-12', 'O-13'], array_column($status->refunds_to_check, 'order_public_id'));
        $this->assertSame('Insufficient funds', $status->refunds_to_check[0]['error']);
        $this->assertSame('CANCELLATION', $status->refunds_to_check[0]['source']);
    }

    public function test_the_audience_counts_orders_by_how_they_were_paid(): void
    {
        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('findById')->andReturn((new EventDomainObject())->setId(5));

        $order = fn(int $id) => (new OrderDomainObject())->setId($id)->setStatus(OrderStatus::COMPLETED->name)->setTotalGross(20.0)->setTotalRefunded(0.0);
        $recipientService = Mockery::mock(EventChangeRecipientService::class);
        $recipientService->shouldReceive('forEvent')->andReturn(new EventChangeRecipientsDTO(
            orders: collect([
                $order(1)->setPaymentProvider(PaymentProviders::STRIPE->name)->setStripePayment(new StripePaymentDomainObject()),
                $order(2)->setPaymentProvider(PaymentProviders::OFFLINE->name),
                $order(3)->setTotalGross(0.0),
            ]),
            attendees: collect([new AttendeeDomainObject()]),
        ));

        $dateChangeRepository = Mockery::mock(EventDateChangeRepositoryInterface::class);
        $dateChangeRepository->shouldReceive('findWhere')->andReturn(collect());
        $cancellationRepository = Mockery::mock(EventCancellationRepositoryInterface::class);
        $cancellationRepository->shouldReceive('findFirstWhere')->andReturnNull();
        $refundRepository = Mockery::mock(EventChangeRefundRepositoryInterface::class);
        $refundRepository->shouldReceive('findWhere')->andReturn(collect());

        $status = (new GetEventChangeStatusHandler(
            $eventRepository,
            $dateChangeRepository,
            $cancellationRepository,
            $refundRepository,
            Mockery::mock(OrderRepositoryInterface::class),
            $recipientService,
            new EventOrderRefundService(
                Mockery::mock(OrderRepositoryInterface::class),
                Mockery::mock(OrderCancelService::class),
                Mockery::mock(RefundOrderHandler::class),
                Mockery::mock(DatabaseManager::class),
            ),
        ))->handle(5);

        $this->assertSame([
            'orders' => 3,
            'recipients' => 4,
            'paid_online_orders' => 1,
            'paid_offline_orders' => 1,
            'unpaid_orders' => 1,
        ], $status->audience);
        $this->assertNull($status->cancellation);
    }
}
