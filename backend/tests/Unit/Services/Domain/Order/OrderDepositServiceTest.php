<?php

namespace Tests\Unit\Services\Domain\Order;

use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\OrderDepositStatus;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\Order\OrderDepositService;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Database\DatabaseManager;
use Mockery as m;
use Tests\TestCase;

class OrderDepositServiceTest extends TestCase
{
    private OrderRepositoryInterface $orderRepository;
    private OrderDepositService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $databaseManager = m::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(fn($callback) => $callback());

        $this->service = new OrderDepositService(
            orderRepository: $this->orderRepository,
            eventRepository: m::mock(EventRepositoryInterface::class),
            mailer: m::mock(Mailer::class),
            databaseManager: $databaseManager,
        );
    }

    private function order(int $id, float $deposit, string $status = 'RECEIVED', float $retained = 0, ?string $note = null): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setId($id)
            ->setEventId(1)
            ->setDepositAmount($deposit)
            ->setDepositStatus($status)
            ->setDepositRetainedAmount($retained)
            ->setDepositNote($note);
    }

    public function testReturningADepositClearsTheRetainedAmount(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->order(5, 100, 'RETAINED', 40, 'Bris'));
        $this->orderRepository->shouldReceive('updateFromArray')
            ->once()
            ->with(5, m::on(fn(array $data) => $data['deposit_status'] === 'RETURNED'
                && $data['deposit_retained_amount'] === 0.0
                && $data['deposit_note'] === null
                && $data['deposit_resolved_at'] !== null))
            ->andReturn($this->order(5, 100, 'RETURNED'));

        $this->service->update(1, 5, OrderDepositStatus::RETURNED, null, null, false);
    }

    public function testRetainingWithoutAmountKeepsTheWholeDeposit(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->order(5, 100));
        $this->orderRepository->shouldReceive('updateFromArray')
            ->once()
            ->with(5, m::on(fn(array $data) => $data['deposit_retained_amount'] === 100.0
                && $data['deposit_note'] === 'Absent'))
            ->andReturn($this->order(5, 100, 'RETAINED', 100));

        $this->service->update(1, 5, OrderDepositStatus::RETAINED, null, '<b>Absent</b>', false);
    }

    public function testRetainingMoreThanTheDepositIsRefused(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->order(5, 100));
        $this->orderRepository->shouldNotReceive('updateFromArray');

        $this->expectException(ResourceConflictException::class);
        $this->service->update(1, 5, OrderDepositStatus::RETAINED, 150, null, false);
    }

    public function testOrderWithoutDepositIsRefused(): void
    {
        $this->orderRepository->shouldReceive('findFirstWhere')->andReturn($this->order(5, 0));

        $this->expectException(ResourceConflictException::class);
        $this->service->update(1, 5, OrderDepositStatus::RECEIVED, null, null, false);
    }

    public function testSplitDividesEquallyAndPlacesLeftoverCents(): void
    {
        $this->orderRepository->shouldReceive('findWhereIn')->andReturn(collect([
            $this->order(1, 100),
            $this->order(2, 100),
            $this->order(3, 100),
        ]));

        $retained = [];
        $this->orderRepository->shouldReceive('updateFromArray')
            ->times(3)
            ->andReturnUsing(function (int $id, array $data) use (&$retained) {
                $retained[$id] = $data['deposit_retained_amount'];
                $this->assertSame('RETAINED', $data['deposit_status']);
                $this->assertSame('Porte-patio', $data['deposit_note']);

                return $this->order($id, 100, 'RETAINED', $data['deposit_retained_amount']);
            });

        $this->service->splitRetention(1, 100, 'Porte-patio', [1, 2, 3], false);

        $this->assertEqualsWithDelta(100.0, array_sum($retained), 0.001);
        $this->assertEqualsCanonicalizing([33.34, 33.33, 33.33], array_values($retained));
    }

    public function testSplitAddsToWhatWasAlreadyRetainedAndIgnoresUnreceivedDeposits(): void
    {
        $this->orderRepository->shouldReceive('findWhereIn')->andReturn(collect([
            $this->order(1, 100, 'RETAINED', 50, 'Absent'),
            $this->order(2, 100),
            $this->order(3, 100, 'PENDING'),
        ]));

        $retained = [];
        $this->orderRepository->shouldReceive('updateFromArray')
            ->twice()
            ->andReturnUsing(function (int $id, array $data) use (&$retained) {
                $retained[$id] = $data;

                return $this->order($id, 100, 'RETAINED', $data['deposit_retained_amount']);
            });

        $this->service->splitRetention(1, 30, 'Vaisselle', [1, 2, 3], false);

        $this->assertSame(60.0, $retained[1]['deposit_retained_amount']);
        $this->assertSame("Absent\nVaisselle", $retained[1]['deposit_note']);
        $this->assertSame(20.0, $retained[2]['deposit_retained_amount']);
        $this->assertArrayNotHasKey(3, $retained);
    }

    public function testSplitCannotExceedWhatIsLeft(): void
    {
        $this->orderRepository->shouldReceive('findWhereIn')->andReturn(collect([
            $this->order(1, 100, 'RETAINED', 90),
            $this->order(2, 100),
        ]));
        $this->orderRepository->shouldNotReceive('updateFromArray');

        $this->expectException(ResourceConflictException::class);
        $this->service->splitRetention(1, 111, 'Bris', [1, 2], false);
    }
}
