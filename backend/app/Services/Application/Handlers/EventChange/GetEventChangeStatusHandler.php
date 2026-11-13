<?php

namespace HiEvents\Services\Application\Handlers\EventChange;

use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\Generated\EventCancellationDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\EventChangeRefundDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\EventDateChangeDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Repository\Interfaces\EventCancellationRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\EventChangeStatusDTO;
use HiEvents\Services\Domain\EventChange\EventChangeRecipientService;
use HiEvents\Services\Domain\EventChange\EventOrderRefundService;

class GetEventChangeStatusHandler
{
    private const DATE_CHANGES_SHOWN = 5;

    // Not NOT_REFUNDED: the organizer chose it, the card says so once rather than order by order.
    private const TO_CHECK = [
        EventChangeRefundStatus::PENDING,
        EventChangeRefundStatus::MANUAL_REFUND_REQUIRED,
        EventChangeRefundStatus::FAILED,
    ];

    public function __construct(
        private readonly EventRepositoryInterface             $eventRepository,
        private readonly EventDateChangeRepositoryInterface   $eventDateChangeRepository,
        private readonly EventCancellationRepositoryInterface $eventCancellationRepository,
        private readonly EventChangeRefundRepositoryInterface $eventChangeRefundRepository,
        private readonly OrderRepositoryInterface             $orderRepository,
        private readonly EventChangeRecipientService          $recipientService,
        private readonly EventOrderRefundService              $eventOrderRefundService,
    )
    {
    }

    public function handle(int $eventId): EventChangeStatusDTO
    {
        $event = $this->eventRepository->findById($eventId);
        $recipients = $this->recipientService->forEvent($eventId);
        $refunds = $this->eventChangeRefundRepository->findWhere([
            EventChangeRefundDomainObjectAbstract::EVENT_ID => $eventId,
        ]);

        /** @var EventCancellationDomainObject|null $cancellation */
        $cancellation = $this->eventCancellationRepository->findFirstWhere([
            EventCancellationDomainObjectAbstract::EVENT_ID => $eventId,
        ]);

        return new EventChangeStatusDTO(
            cancelled_at: $event->getCancelledAt(),
            audience: [
                'orders' => $recipients->orders->count(),
                'recipients' => $recipients->count(),
                'paid_online_orders' => $recipients->orders->filter(fn(OrderDomainObject $order) => $this->eventOrderRefundService->isPaidOnline($order))->count(),
                'paid_offline_orders' => $recipients->orders->filter(fn(OrderDomainObject $order) => !$this->eventOrderRefundService->isUnpaid($order)
                    && !$this->eventOrderRefundService->isPaidOnline($order))->count(),
                'unpaid_orders' => $recipients->orders->filter(fn(OrderDomainObject $order) => $this->eventOrderRefundService->isUnpaid($order))->count(),
            ],
            date_changes: $this->eventDateChangeRepository
                ->findWhere([EventDateChangeDomainObjectAbstract::EVENT_ID => $eventId])
                ->sortByDesc(fn(EventDateChangeDomainObject $dateChange) => $dateChange->getId())
                ->take(self::DATE_CHANGES_SHOWN)
                ->map(fn(EventDateChangeDomainObject $dateChange) => [
                    'id' => $dateChange->getId(),
                    'old_start_date' => $dateChange->getOldStartDate(),
                    'old_end_date' => $dateChange->getOldEndDate(),
                    'new_start_date' => $dateChange->getNewStartDate(),
                    'new_end_date' => $dateChange->getNewEndDate(),
                    'refunds_allowed' => $dateChange->getRefundsAllowed(),
                    'refund_deadline' => $dateChange->getRefundDeadline(),
                    'recipients_count' => $dateChange->getRecipientsCount(),
                    'refunds_count' => $refunds->filter(fn(EventChangeRefundDomainObject $refund) => $refund->getEventDateChangeId() === $dateChange->getId())->count(),
                    'created_at' => $dateChange->getCreatedAt(),
                ])
                ->values()
                ->all(),
            cancellation: $cancellation ? [
                'id' => $cancellation->getId(),
                'refund_orders' => $cancellation->getRefundOrders(),
                'recipients_count' => $cancellation->getRecipientsCount(),
                'created_at' => $cancellation->getCreatedAt(),
                'counts' => collect(EventChangeRefundStatus::cases())
                    ->mapWithKeys(fn(EventChangeRefundStatus $status) => [
                        $status->name => $refunds->filter(fn(EventChangeRefundDomainObject $refund) => $refund->getEventCancellationId() === $cancellation->getId()
                            && $refund->getStatus() === $status->name)->count(),
                    ])
                    ->all(),
            ] : null,
            refunds_to_check: $this->refundsToCheck($refunds->filter(
                fn(EventChangeRefundDomainObject $refund) => in_array($refund->getStatus(), array_map(fn($status) => $status->name, self::TO_CHECK), true),
            )),
        );
    }

    private function refundsToCheck($refunds): array
    {
        if ($refunds->isEmpty()) {
            return [];
        }

        $orders = $this->orderRepository
            ->findWhereIn('id', $refunds->map(fn(EventChangeRefundDomainObject $refund) => $refund->getOrderId())->values()->all())
            ->keyBy(fn(OrderDomainObject $order) => $order->getId());

        return $refunds
            ->sortBy(fn(EventChangeRefundDomainObject $refund) => $refund->getId())
            ->map(function (EventChangeRefundDomainObject $refund) use ($orders) {
                /** @var OrderDomainObject|null $order */
                $order = $orders->get($refund->getOrderId());

                return [
                    'order_id' => $refund->getOrderId(),
                    'order_public_id' => $order?->getPublicId(),
                    'buyer_name' => $order?->getFullName(),
                    'buyer_email' => $order?->getEmail(),
                    'status' => $refund->getStatus(),
                    'amount' => $refund->getAmount(),
                    'currency' => $refund->getCurrency() ?? $order?->getCurrency(),
                    'error' => $refund->getError(),
                    'source' => $refund->getEventCancellationId() !== null ? 'CANCELLATION' : 'POSTPONEMENT',
                ];
            })
            ->values()
            ->all();
    }
}
