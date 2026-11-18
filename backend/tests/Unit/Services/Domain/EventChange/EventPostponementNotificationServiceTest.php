<?php

namespace Tests\Unit\Services\Domain\EventChange;

use Carbon\Carbon;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\DomainObjects\StripePaymentDomainObject;
use HiEvents\Mail\EventChange\EventPostponedMail;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\Order\Payment\Stripe\RefundOrderHandler;
use HiEvents\Services\Domain\EventChange\DTO\EventChangeRecipientsDTO;
use HiEvents\Services\Domain\EventChange\EventChangeRecipientService;
use HiEvents\Services\Domain\EventChange\EventOrderRefundService;
use HiEvents\Services\Domain\EventChange\EventPostponementNotificationService;
use HiEvents\Services\Domain\EventChange\RefundRequestTokenService;
use HiEvents\Services\Domain\Order\OrderCancelService;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Database\DatabaseManager;
use Illuminate\Mail\PendingMail;
use Mockery;
use Tests\TestCase;

class EventPostponementNotificationServiceTest extends TestCase
{
    private EventChangeRecipientService $recipientService;
    private EventDateChangeRepositoryInterface $dateChangeRepository;
    private EventPostponementNotificationService $service;

    /** @var array<int, array{0: string, 1: EventPostponedMail}> */
    private array $sent = [];

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-12 12:00:00', 'UTC'));
        config(['app.frontend_url' => 'https://billets.test', 'app.key' => 'base64:test-key']);

        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findById')->with(5)->andReturn(
            (new EventDomainObject())
                ->setId(5)
                ->setTitle('Trail du Mont')
                ->setOrganizer((new OrganizerDomainObject())->setId(3)->setName('Club Dehors'))
                ->setEventSettings(new EventSettingDomainObject()),
        );

        $this->dateChangeRepository = Mockery::mock(EventDateChangeRepositoryInterface::class);
        $this->recipientService = Mockery::mock(EventChangeRecipientService::class);

        $to = null;
        $pending = Mockery::mock(PendingMail::class);
        $pending->shouldReceive('locale')->andReturnSelf();
        $pending->shouldReceive('send')->andReturnUsing(function ($mail) use (&$to) {
            $this->sent[] = [$to, $mail];
            return null;
        });
        $mailer = Mockery::mock(Mailer::class);
        $mailer->shouldReceive('to')->andReturnUsing(function ($email) use (&$to, $pending) {
            $to = $email;
            return $pending;
        });

        $this->service = new EventPostponementNotificationService(
            eventRepository: $eventRepository,
            eventDateChangeRepository: $this->dateChangeRepository,
            recipientService: $this->recipientService,
            eventOrderRefundService: new EventOrderRefundService(
                orderRepository: Mockery::mock(OrderRepositoryInterface::class),
                orderCancelService: Mockery::mock(OrderCancelService::class),
                refundOrderHandler: Mockery::mock(RefundOrderHandler::class),
                databaseManager: Mockery::mock(DatabaseManager::class),
            ),
            tokenService: new RefundRequestTokenService(app('config')),
            mailer: $mailer,
        );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_one_email_per_order_and_one_per_other_participant(): void
    {
        $this->givenDateChange(refundsAllowed: true);
        $this->givenRecipients(
            orders: [$this->paidOnlineOrder(1, 'alex@example.com'), $this->freeOrder(2, 'robin@example.com')],
            attendees: [(new AttendeeDomainObject())->setId(30)->setOrderId(1)->setEmail('sam@example.com')->setFirstName('Sam')->setLastName('L')],
        );

        $count = $this->service->notify(7);

        $this->assertSame(3, $count);
        $this->assertSame(['alex@example.com', 'robin@example.com', 'sam@example.com'], array_column($this->sent, 0));
        $this->assertContainsOnlyInstancesOf(EventPostponedMail::class, array_column($this->sent, 1));
    }

    public function test_only_orders_paid_online_get_the_refund_link(): void
    {
        $this->givenDateChange(refundsAllowed: true);
        $this->givenRecipients(
            orders: [
                $this->paidOnlineOrder(1, 'online@example.com'),
                $this->freeOrder(2, 'free@example.com'),
                $this->paidOfflineOrder(3, 'offline@example.com'),
                $this->paidOnlineOrder(4, 'refunded@example.com')->setTotalRefunded(50.0),
            ],
            attendees: [(new AttendeeDomainObject())->setId(30)->setOrderId(1)->setEmail('friend@example.com')],
        );

        $this->service->notify(7);

        $links = array_combine(
            array_column($this->sent, 0),
            array_map(fn(EventPostponedMail $mail) => $mail->refundUrl, array_column($this->sent, 1)),
        );

        $this->assertStringStartsWith('https://billets.test/order/5/ORD1/refund-request?change=7&token=', $links['online@example.com']);
        $this->assertNull($links['free@example.com']);
        $this->assertNull($links['offline@example.com']);
        $this->assertNull($links['refunded@example.com']);
        $this->assertNull($links['friend@example.com']);
    }

    public function test_no_refund_link_when_refunds_are_not_offered(): void
    {
        $this->givenDateChange(refundsAllowed: false);
        $this->givenRecipients(orders: [$this->paidOnlineOrder(1, 'online@example.com')], attendees: []);

        $this->service->notify(7);

        $this->assertNull($this->sent[0][1]->refundUrl);
    }

    public function test_the_link_carries_a_token_for_this_order_and_this_change(): void
    {
        $this->givenDateChange(refundsAllowed: true);
        $this->givenRecipients(orders: [$this->paidOnlineOrder(1, 'online@example.com')], attendees: []);

        $this->service->notify(7);

        parse_str(parse_url($this->sent[0][1]->refundUrl, PHP_URL_QUERY), $query);
        $tokens = new RefundRequestTokenService(app('config'));

        $this->assertTrue($tokens->isValid(1, 7, $query['token']));
        $this->assertFalse($tokens->isValid(2, 7, $query['token']));
        $this->assertFalse($tokens->isValid(1, 8, $query['token']));
    }

    private function givenDateChange(bool $refundsAllowed): void
    {
        $this->dateChangeRepository->shouldReceive('findById')->with(7)->andReturn(
            (new EventDateChangeDomainObject())
                ->setId(7)
                ->setEventId(5)
                ->setMessage('Tempête: on reporte.')
                ->setNewStartDate('2026-11-21 14:00:00')
                ->setRefundsAllowed($refundsAllowed)
                ->setRefundDeadline($refundsAllowed ? '2026-11-19 14:00:00' : null),
        );
    }

    private function givenRecipients(array $orders, array $attendees): void
    {
        $this->recipientService->shouldReceive('forEvent')->with(5)->andReturn(
            new EventChangeRecipientsDTO(orders: collect($orders), attendees: collect($attendees)),
        );
    }

    private function order(int $id, string $email): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setId($id)
            ->setEventId(5)
            ->setShortId('ORD' . $id)
            ->setEmail($email)
            ->setFirstName('Alex')
            ->setLastName('Tremblay')
            ->setLocale('fr')
            ->setCurrency('CAD')
            ->setTotalRefunded(0.0)
            ->setStatus(OrderStatus::COMPLETED->name);
    }

    private function paidOnlineOrder(int $id, string $email): OrderDomainObject
    {
        return $this->order($id, $email)
            ->setTotalGross(50.0)
            ->setPaymentProvider(PaymentProviders::STRIPE->name)
            ->setStripePayment((new StripePaymentDomainObject())->setId(100 + $id));
    }

    private function paidOfflineOrder(int $id, string $email): OrderDomainObject
    {
        return $this->order($id, $email)
            ->setTotalGross(50.0)
            ->setPaymentProvider(PaymentProviders::OFFLINE->name);
    }

    private function freeOrder(int $id, string $email): OrderDomainObject
    {
        return $this->order($id, $email)->setTotalGross(0.0);
    }
}
