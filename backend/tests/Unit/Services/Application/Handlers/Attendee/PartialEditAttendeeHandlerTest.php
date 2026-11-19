<?php

namespace Tests\Unit\Services\Application\Handlers\Attendee;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\Attendee\DTO\PartialEditAttendeeDTO;
use HiEvents\Services\Application\Handlers\Attendee\PartialEditAttendeeHandler;
use HiEvents\Services\Domain\EventStatistics\EventStatisticsCancellationService;
use HiEvents\Services\Domain\EventStatistics\EventStatisticsReactivationService;
use HiEvents\Services\Domain\Product\ProductQuantityUpdateService;
use HiEvents\Services\Infrastructure\DomainEvents\DomainEventDispatcherService;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Facades\Event;
use Mockery as m;
use Psr\Log\LoggerInterface;
use Tests\TestCase;

class PartialEditAttendeeHandlerTest extends TestCase
{
    private EventStatisticsCancellationService $cancellationService;
    private EventStatisticsReactivationService $reactivationService;
    private PartialEditAttendeeHandler $handler;
    private OrderRepositoryInterface $orderRepository;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake();

        $attendee = (new AttendeeDomainObject())
            ->setId(5)
            ->setEventId(9)
            ->setOrderId(3)
            ->setProductId(1)
            ->setProductPriceId(2)
            ->setStatus('AWAITING_PAYMENT')
            ->setFirstName('Clovis')
            ->setLastName('Leclerc')
            ->setEmail('clovis@example.com');

        $attendeeRepository = m::mock(AttendeeRepositoryInterface::class);
        $attendeeRepository->shouldReceive('findFirstWhere')->andReturn($attendee);
        $attendeeRepository->shouldReceive('updateByIdWhere')->andReturn($attendee);

        $productQuantityService = m::mock(ProductQuantityUpdateService::class);
        $productQuantityService->shouldReceive('decreaseQuantitySold', 'increaseQuantitySold');

        $databaseManager = m::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(fn(callable $callback) => $callback());

        $dispatcher = m::mock(DomainEventDispatcherService::class);
        $dispatcher->shouldReceive('dispatch');

        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $this->cancellationService = m::mock(EventStatisticsCancellationService::class);
        $this->reactivationService = m::mock(EventStatisticsReactivationService::class);

        $this->handler = new PartialEditAttendeeHandler(
            $attendeeRepository,
            $this->orderRepository,
            $productQuantityService,
            $databaseManager,
            $dispatcher,
            $this->cancellationService,
            $this->reactivationService,
            m::mock(LoggerInterface::class),
        );
    }

    protected function tearDown(): void
    {
        $this->addToAssertionCount(m::getContainer()->mockery_getExpectationCount());
        m::close();
        parent::tearDown();
    }

    public function testCancellingAnAttendeeOfAnUnpaidOfflineOrderLeavesTheStatisticsAlone(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->order('AWAITING_OFFLINE_PAYMENT'));
        $this->cancellationService->shouldNotReceive('decrementForCancelledAttendee');

        $this->handler->handle($this->cancel());
    }

    public function testCancellingAnAttendeeOfACompletedOrderTakesItOffTheStatistics(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->order('COMPLETED'));
        $this->cancellationService->shouldReceive('decrementForCancelledAttendee')->once()
            ->with(9, '2026-11-01 10:00:00');

        $this->handler->handle($this->cancel());
    }

    private function order(string $status): OrderDomainObject
    {
        return (new OrderDomainObject())->setId(3)->setStatus($status)->setCreatedAt('2026-11-01 10:00:00');
    }

    private function cancel(): PartialEditAttendeeDTO
    {
        return new PartialEditAttendeeDTO(
            attendee_id: 5,
            event_id: 9,
            first_name: null,
            last_name: null,
            email: null,
            status: 'CANCELLED',
        );
    }
}
