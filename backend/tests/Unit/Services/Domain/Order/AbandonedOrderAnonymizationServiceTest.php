<?php

namespace Tests\Unit\Services\Domain\Order;

use Carbon\Carbon;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderAuditLogRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionAnswerRepositoryInterface;
use HiEvents\Services\Domain\Order\AbandonedOrderAnonymizationService;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Mockery as m;
use Tests\TestCase;

class AbandonedOrderAnonymizationServiceTest extends TestCase
{
    private OrderRepositoryInterface $orderRepository;
    private AttendeeRepositoryInterface $attendeeRepository;
    private QuestionAnswerRepositoryInterface $questionAnswerRepository;
    private OrderAuditLogRepositoryInterface $orderAuditLogRepository;
    private DatabaseManager $databaseManager;
    private AbandonedOrderAnonymizationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-12-01 12:00:00');

        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $this->attendeeRepository = m::mock(AttendeeRepositoryInterface::class);
        $this->questionAnswerRepository = m::mock(QuestionAnswerRepositoryInterface::class);
        $this->orderAuditLogRepository = m::mock(OrderAuditLogRepositoryInterface::class);
        $this->databaseManager = m::mock(DatabaseManager::class);

        $this->orderRepository->shouldReceive('includeDeleted')->andReturnSelf();
        $this->attendeeRepository->shouldReceive('includeDeleted')->andReturnSelf();
        $this->questionAnswerRepository->shouldReceive('includeDeleted')->andReturnSelf();

        $this->databaseManager
            ->shouldReceive('transaction')
            ->andReturnUsing(fn($callback) => $callback());

        $this->service = new AbandonedOrderAnonymizationService(
            orderRepository: $this->orderRepository,
            attendeeRepository: $this->attendeeRepository,
            questionAnswerRepository: $this->questionAnswerRepository,
            orderAuditLogRepository: $this->orderAuditLogRepository,
            databaseManager: $this->databaseManager,
        );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        m::close();
        parent::tearDown();
    }

    public function testAnonymizesPersonalDataOfAbandonedOrdersOlderThanRetention(): void
    {
        $this->orderRepository
            ->shouldReceive('findWhere')
            ->once()
            ->with(
                [
                    ['status', 'in', [OrderStatus::ABANDONED->name, OrderStatus::RESERVED->name]],
                    ['email', 'not null', null],
                    ['updated_at', '<', '2026-09-02 12:00:00'],
                ],
                ['id'],
            )
            ->andReturn($this->ordersWithIds([10, 11]));

        $this->orderRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(
                [
                    'first_name' => null,
                    'last_name' => null,
                    'email' => null,
                    'address' => null,
                    'notes' => null,
                    'session_id' => null,
                ],
                [['id', 'in', [10, 11]]],
            )
            ->andReturn(2);

        $this->attendeeRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(
                ['first_name' => '', 'last_name' => '', 'email' => '', 'notes' => null],
                [['order_id', 'in', [10, 11]]],
            )
            ->andReturn(3);

        $this->questionAnswerRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(['answer' => null], [['order_id', 'in', [10, 11]]])
            ->andReturn(1);

        $this->orderAuditLogRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->with(
                ['old_values' => null, 'new_values' => null, 'ip_address' => null, 'user_agent' => null],
                [['order_id', 'in', [10, 11]]],
            )
            ->andReturn(0);

        $this->assertSame(2, $this->service->anonymizeExpiredAbandonedOrders());
    }

    public function testDoesNothingWhenNoOrderIsPastRetention(): void
    {
        $this->orderRepository
            ->shouldReceive('findWhere')
            ->once()
            ->andReturn(new Collection());

        $this->orderRepository->shouldNotReceive('updateWhere');
        $this->attendeeRepository->shouldNotReceive('updateWhere');
        $this->questionAnswerRepository->shouldNotReceive('updateWhere');
        $this->orderAuditLogRepository->shouldNotReceive('updateWhere');

        $this->assertSame(0, $this->service->anonymizeExpiredAbandonedOrders());
    }

    public function testProcessesLargeBatchesInChunks(): void
    {
        $this->orderRepository
            ->shouldReceive('findWhere')
            ->once()
            ->andReturn($this->ordersWithIds(range(1, 501)));

        $this->orderRepository->shouldReceive('updateWhere')->twice()->andReturn(1);
        $this->attendeeRepository->shouldReceive('updateWhere')->twice()->andReturn(1);
        $this->questionAnswerRepository->shouldReceive('updateWhere')->twice()->andReturn(1);
        $this->orderAuditLogRepository->shouldReceive('updateWhere')->twice()->andReturn(0);

        $this->assertSame(501, $this->service->anonymizeExpiredAbandonedOrders());
    }

    private function ordersWithIds(array $ids): Collection
    {
        return new Collection(array_map(static function (int $id) {
            $order = new OrderDomainObject();
            $order->setId($id);

            return $order;
        }, $ids));
    }
}
