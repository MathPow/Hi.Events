<?php

namespace Tests\Unit\Services\Domain\EventChange;

use Carbon\Carbon;
use HiEvents\DomainObjects\AttendeeCheckInDomainObject;
use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\OrderRefundStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Exceptions\InvalidRefundRequestTokenException;
use HiEvents\Repository\Interfaces\AttendeeCheckInRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestDTO;
use HiEvents\Services\Application\Handlers\Order\Payment\Stripe\RefundOrderHandler;
use HiEvents\Services\Domain\EventChange\DTO\RefundRequestContextDTO;
use HiEvents\Services\Domain\EventChange\Enums\RefundRequestRefusal;
use HiEvents\Services\Domain\EventChange\EventOrderRefundService;
use HiEvents\Services\Domain\EventChange\RefundRequestService;
use HiEvents\Services\Domain\EventChange\RefundRequestTokenService;
use HiEvents\Services\Domain\Order\OrderCancelService;
use Illuminate\Database\DatabaseManager;
use Mockery;
use Tests\TestCase;

class RefundRequestServiceTest extends TestCase
{
    private EventDateChangeRepositoryInterface $dateChangeRepository;
    private OrderRepositoryInterface $orderRepository;
    private AttendeeCheckInRepositoryInterface $checkInRepository;
    private RefundRequestTokenService $tokens;
    private RefundRequestService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-12 12:00:00', 'UTC'));
        config(['app.key' => 'base64:test-key']);

        $this->dateChangeRepository = Mockery::mock(EventDateChangeRepositoryInterface::class);
        $this->dateChangeRepository->shouldReceive('findWhere')->andReturn(collect([
            (new EventDateChangeDomainObject())->setId(6),
            (new EventDateChangeDomainObject())->setId(7),
        ]))->byDefault();

        $this->orderRepository = Mockery::mock(OrderRepositoryInterface::class);
        $this->orderRepository->shouldReceive('loadRelation')->andReturnSelf();

        $this->checkInRepository = Mockery::mock(AttendeeCheckInRepositoryInterface::class);
        $this->checkInRepository->shouldReceive('findFirstWhere')->andReturnNull()->byDefault();

        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findById')->andReturn($this->event());

        $refundRepository = Mockery::mock(EventChangeRefundRepositoryInterface::class);
        $refundRepository->shouldReceive('findFirstWhere')->andReturnNull();

        $this->tokens = new RefundRequestTokenService(app('config'));

        $this->service = new RefundRequestService(
            eventRepository: $eventRepository,
            eventDateChangeRepository: $this->dateChangeRepository,
            eventChangeRefundRepository: $refundRepository,
            attendeeCheckInRepository: $this->checkInRepository,
            eventOrderRefundService: new EventOrderRefundService(
                orderRepository: $this->orderRepository,
                orderCancelService: Mockery::mock(OrderCancelService::class),
                refundOrderHandler: Mockery::mock(RefundOrderHandler::class),
                databaseManager: Mockery::mock(DatabaseManager::class),
            ),
            tokenService: $this->tokens,
        );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_a_valid_link_finds_the_order_and_the_change(): void
    {
        $this->givenDateChange($this->dateChange());
        $this->givenOrder($this->order());

        $context = $this->service->resolve($this->dto($this->tokens->token(1, 7)));

        $this->assertSame(1, $context->order->getId());
        $this->assertSame(7, $context->dateChange->getId());
    }

    public function test_a_bad_token_is_refused(): void
    {
        $this->givenDateChange($this->dateChange());
        $this->givenOrder($this->order());

        $this->expectException(InvalidRefundRequestTokenException::class);

        $this->service->resolve($this->dto($this->tokens->token(2, 7)));
    }

    public function test_a_missing_token_is_refused(): void
    {
        $this->givenDateChange($this->dateChange());
        $this->givenOrder($this->order());

        $this->expectException(InvalidRefundRequestTokenException::class);

        $this->service->resolve($this->dto(null));
    }

    public function test_a_change_of_another_event_is_refused(): void
    {
        $this->givenDateChange(null);

        $this->expectException(InvalidRefundRequestTokenException::class);

        $this->service->resolve($this->dto($this->tokens->token(1, 7)));
    }

    public function test_a_paid_order_before_the_deadline_can_be_refunded(): void
    {
        $this->assertNull($this->service->refusal($this->context()));
    }

    public function test_refused_after_the_deadline(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-19 14:00:01', 'UTC'));

        $this->assertSame(RefundRequestRefusal::DEADLINE_PASSED, $this->service->refusal($this->context()));
    }

    public function test_refused_when_already_refunded(): void
    {
        $this->assertSame(
            RefundRequestRefusal::ALREADY_REFUNDED,
            $this->service->refusal($this->context(order: $this->order()->setRefundStatus(OrderRefundStatus::REFUNDED->name))),
        );
        $this->assertSame(
            RefundRequestRefusal::ALREADY_REFUNDED,
            $this->service->refusal($this->context(order: $this->order()->setTotalRefunded(50.0))),
        );
    }

    public function test_refused_when_already_cancelled(): void
    {
        $this->assertSame(
            RefundRequestRefusal::ALREADY_CANCELLED,
            $this->service->refusal($this->context(order: $this->order()->setStatus(OrderStatus::CANCELLED->name))),
        );
    }

    public function test_refused_once_a_ticket_was_checked_in(): void
    {
        $this->checkInRepository->shouldReceive('findFirstWhere')->with(['order_id' => 1])->andReturn(new AttendeeCheckInDomainObject());

        $this->assertSame(RefundRequestRefusal::CHECKED_IN, $this->service->refusal($this->context()));
    }

    public function test_refused_when_refunds_were_not_offered(): void
    {
        $this->assertSame(
            RefundRequestRefusal::REFUNDS_NOT_ALLOWED,
            $this->service->refusal($this->context(dateChange: $this->dateChange()->setRefundsAllowed(false)->setRefundDeadline(null))),
        );
    }

    public function test_refused_when_the_event_was_postponed_again(): void
    {
        $this->dateChangeRepository->shouldReceive('findWhere')->andReturn(collect([
            (new EventDateChangeDomainObject())->setId(7),
            (new EventDateChangeDomainObject())->setId(8),
        ]));

        $this->assertSame(RefundRequestRefusal::LINK_REPLACED, $this->service->refusal($this->context()));
    }

    public function test_refused_when_the_event_was_cancelled_since(): void
    {
        $this->assertSame(
            RefundRequestRefusal::EVENT_CANCELLED,
            $this->service->refusal($this->context(event: $this->event()->setCancelledAt('2026-11-12 10:00:00'))),
        );
    }

    private function givenDateChange(?EventDateChangeDomainObject $dateChange): void
    {
        $this->dateChangeRepository->shouldReceive('findFirstWhere')->with(['id' => 7, 'event_id' => 5])->andReturn($dateChange);
    }

    private function givenOrder(OrderDomainObject $order): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->with(['event_id' => 5, 'short_id' => 'ORD1'])->andReturn($order);
    }

    private function dto(?string $token): RefundRequestDTO
    {
        return new RefundRequestDTO(eventId: 5, orderShortId: 'ORD1', dateChangeId: 7, token: $token);
    }

    private function context(
        ?OrderDomainObject           $order = null,
        ?EventDateChangeDomainObject $dateChange = null,
        ?EventDomainObject           $event = null,
    ): RefundRequestContextDTO
    {
        return new RefundRequestContextDTO(
            event: $event ?? $this->event(),
            dateChange: $dateChange ?? $this->dateChange(),
            order: $order ?? $this->order(),
            refund: null,
        );
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject())->setId(5)->setTitle('Trail du Mont')->setTimezone('America/Toronto');
    }

    private function dateChange(): EventDateChangeDomainObject
    {
        return (new EventDateChangeDomainObject())
            ->setId(7)
            ->setEventId(5)
            ->setRefundsAllowed(true)
            ->setRefundDeadline('2026-11-19 14:00:00');
    }

    private function order(): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setId(1)
            ->setEventId(5)
            ->setShortId('ORD1')
            ->setStatus(OrderStatus::COMPLETED->name)
            ->setTotalGross(50.0)
            ->setTotalRefunded(0.0)
            ->setPaymentProvider(PaymentProviders::STRIPE->name)
            ->setStripePayment(new StripePaymentDomainObject());
    }
}
