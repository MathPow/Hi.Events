<?php

namespace Tests\Unit\Services\Domain\EventChange;

use Carbon\Carbon;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Exceptions\EventChangeNotAllowedException;
use HiEvents\Repository\Interfaces\EventCancellationRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\CancelEventDTO;
use HiEvents\Services\Domain\EventChange\DTO\EventChangeRecipientsDTO;
use HiEvents\Services\Domain\EventChange\EventCancellationService;
use Mockery;
use Tests\TestCase;

class EventCancellationServiceTest extends TestCase
{
    private EventRepositoryInterface $eventRepository;
    private EventCancellationRepositoryInterface $cancellationRepository;
    private EventChangeRefundRepositoryInterface $refundRepository;
    private EventCancellationService $service;

    /** @var array<int, array> */
    private array $refunds = [];

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-12 12:00:00', 'UTC'));

        $this->eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $this->cancellationRepository = Mockery::mock(EventCancellationRepositoryInterface::class);
        $this->refundRepository = Mockery::mock(EventChangeRefundRepositoryInterface::class);
        $this->refundRepository->shouldReceive('findWhereIn')->andReturn(collect())->byDefault();
        $this->refundRepository->shouldReceive('create')->andReturnUsing(function (array $attributes) {
            $this->refunds[] = $attributes;
            return new EventChangeRefundDomainObject();
        });

        $this->service = new EventCancellationService(
            eventRepository: $this->eventRepository,
            eventCancellationRepository: $this->cancellationRepository,
            eventChangeRefundRepository: $this->refundRepository,
        );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_the_event_is_marked_cancelled_and_every_order_waits_for_its_job(): void
    {
        $this->eventRepository->shouldReceive('updateWhere')
            ->once()
            ->with(['cancelled_at' => '2026-11-12 12:00:00'], ['id' => 5])
            ->andReturn(1);
        $this->cancellationRepository->shouldReceive('create')
            ->once()
            ->with([
                'event_id' => 5,
                'user_id' => 9,
                'message' => 'Annulé à cause du verglas.',
                'refund_orders' => true,
                'recipients_count' => 3,
            ])
            ->andReturn((new EventCancellationDomainObject())->setId(4));

        $cancellation = $this->service->cancel($this->event(), $this->dto(), $this->recipients());

        $this->assertSame(4, $cancellation->getId());
        $this->assertSame([1, 2], array_column($this->refunds, 'order_id'));
        $this->assertSame([EventChangeRefundStatus::PENDING->name], array_unique(array_column($this->refunds, 'status')));
        $this->assertSame([4], array_unique(array_column($this->refunds, 'event_cancellation_id')));
    }

    public function test_an_order_already_handled_after_a_postponement_is_not_lined_up_again(): void
    {
        $this->eventRepository->shouldReceive('updateWhere')->andReturn(1);
        $this->cancellationRepository->shouldReceive('create')->andReturn((new EventCancellationDomainObject())->setId(4));
        $this->refundRepository->shouldReceive('findWhereIn')->andReturn(collect([
            (new EventChangeRefundDomainObject())->setOrderId(1),
        ]));

        $this->service->cancel($this->event(), $this->dto(), $this->recipients());

        $this->assertSame([2], array_column($this->refunds, 'order_id'));
    }

    public function test_an_event_cannot_be_cancelled_twice(): void
    {
        $this->eventRepository->shouldNotReceive('updateWhere');
        $this->cancellationRepository->shouldNotReceive('create');

        $this->expectException(EventChangeNotAllowedException::class);

        $this->service->cancel($this->event()->setCancelledAt('2026-11-11 08:00:00'), $this->dto(), $this->recipients());
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject())->setId(5);
    }

    private function dto(): CancelEventDTO
    {
        return new CancelEventDTO(eventId: 5, accountId: 1, userId: 9, message: ' Annulé à cause du verglas. ', refundOrders: true);
    }

    private function recipients(): EventChangeRecipientsDTO
    {
        return new EventChangeRecipientsDTO(
            orders: collect([
                (new OrderDomainObject())->setId(1)->setCurrency('CAD'),
                (new OrderDomainObject())->setId(2)->setCurrency('CAD'),
            ]),
            attendees: collect([new AttendeeDomainObject()]),
        );
    }
}
