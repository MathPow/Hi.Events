<?php

namespace HiEvents\Services\Domain\Order;

use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderAuditLogRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\QuestionAnswerRepositoryInterface;
use Illuminate\Database\DatabaseManager;
use Throwable;

class AbandonedOrderAnonymizationService
{
    public const RETENTION_DAYS = 90;

    private const CHUNK_SIZE = 500;

    public function __construct(
        private readonly OrderRepositoryInterface          $orderRepository,
        private readonly AttendeeRepositoryInterface       $attendeeRepository,
        private readonly QuestionAnswerRepositoryInterface $questionAnswerRepository,
        private readonly OrderAuditLogRepositoryInterface  $orderAuditLogRepository,
        private readonly DatabaseManager                   $databaseManager,
    )
    {
    }

    /**
     * @throws Throwable
     */
    public function anonymizeExpiredAbandonedOrders(): int
    {
        $orderIds = $this->orderRepository
            ->includeDeleted()
            ->findWhere(
                where: [
                    ['status', 'in', [OrderStatus::ABANDONED->name, OrderStatus::RESERVED->name]],
                    ['email', 'not null', null],
                    ['updated_at', '<', now()->subDays(self::RETENTION_DAYS)->toDateTimeString()],
                ],
                columns: ['id'],
            )
            ->map(fn(OrderDomainObject $order) => $order->getId())
            ->all();

        foreach (array_chunk($orderIds, self::CHUNK_SIZE) as $chunk) {
            $this->databaseManager->transaction(fn() => $this->anonymizeOrders($chunk));
        }

        return count($orderIds);
    }

    private function anonymizeOrders(array $orderIds): void
    {
        $this->orderRepository->includeDeleted()->updateWhere(
            attributes: [
                'first_name' => null,
                'last_name' => null,
                'email' => null,
                'address' => null,
                'notes' => null,
                'session_id' => null,
            ],
            where: [['id', 'in', $orderIds]],
        );

        $this->attendeeRepository->includeDeleted()->updateWhere(
            attributes: [
                'first_name' => '',
                'last_name' => '',
                'email' => '',
                'notes' => null,
            ],
            where: [['order_id', 'in', $orderIds]],
        );

        $this->questionAnswerRepository->includeDeleted()->updateWhere(
            attributes: ['answer' => null],
            where: [['order_id', 'in', $orderIds]],
        );

        $this->orderAuditLogRepository->updateWhere(
            attributes: [
                'old_values' => null,
                'new_values' => null,
                'ip_address' => null,
                'user_agent' => null,
            ],
            where: [['order_id', 'in', $orderIds]],
        );
    }
}
