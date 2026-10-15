<?php

namespace HiEvents\Services\Domain\Order;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\OrderDepositStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Helper\Currency;
use HiEvents\Mail\Order\OrderDepositResolved;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;

class OrderDepositService
{
    private const RESOLVED_STATUSES = [
        OrderDepositStatus::RETURNED,
        OrderDepositStatus::RETAINED,
    ];

    public function __construct(
        private readonly OrderRepositoryInterface $orderRepository,
        private readonly EventRepositoryInterface $eventRepository,
        private readonly Mailer                   $mailer,
        private readonly DatabaseManager          $databaseManager,
    )
    {
    }

    /**
     * Les commandes jamais confirmees (panier abandonne, reservation en cours)
     * n'ont rien envoye: elles n'ont pas leur place dans le suivi des depots.
     *
     * @return Collection<OrderDomainObject>
     */
    public function getDepositOrders(int $eventId): Collection
    {
        return $this->orderRepository->findWhere(
            where: [
                'event_id' => $eventId,
                ['deposit_amount', '>', 0],
                ['status', 'not in', [OrderStatus::RESERVED->name, OrderStatus::ABANDONED->name]],
            ],
            orderAndDirections: [new OrderAndDirection(order: 'id', direction: 'asc')],
        );
    }

    /**
     * @throws ResourceConflictException
     */
    public function update(
        int                $eventId,
        int                $orderId,
        OrderDepositStatus $status,
        ?float             $retainedAmount,
        ?string            $note,
        bool               $notify,
    ): OrderDomainObject
    {
        $order = $this->findDepositOrder($eventId, $orderId);
        $deposit = $order->getDepositAmount();

        $retained = $status === OrderDepositStatus::RETAINED
            ? Currency::round($retainedAmount ?? $deposit)
            : 0.0;

        if ($status === OrderDepositStatus::RETAINED && ($retained <= 0 || $retained > $deposit)) {
            throw new ResourceConflictException(__('The retained amount must be greater than zero and cannot exceed the deposit.'));
        }

        $updated = $this->orderRepository->updateFromArray($order->getId(), [
            'deposit_status' => $status->name,
            'deposit_retained_amount' => $retained,
            'deposit_note' => $this->resolveNote($status, $note, $order),
            'deposit_resolved_at' => in_array($status, self::RESOLVED_STATUSES, true) ? Carbon::now() : null,
        ]);

        if ($notify && in_array($status, self::RESOLVED_STATUSES, true)) {
            $this->notifyBuyers($eventId, collect([$updated]));
        }

        return $updated;
    }

    /**
     * Repartit un montant (bris commun) entre les depots recus, au prorata de
     * ce qu'il reste de chacun: a depots egaux, la part est egale. Les cents
     * restants vont aux plus grosses fractions pour que la somme tombe juste.
     *
     * @param int[] $orderIds
     * @return Collection<OrderDomainObject>
     * @throws ResourceConflictException
     */
    public function splitRetention(int $eventId, float $amount, string $note, array $orderIds, bool $notify): Collection
    {
        $orders = $this->orderRepository
            ->findWhereIn('id', $orderIds, ['event_id' => $eventId])
            ->filter(fn(OrderDomainObject $order) => $order->getDepositAmount() > 0
                && in_array($order->getDepositStatus(), [OrderDepositStatus::RECEIVED->name, OrderDepositStatus::RETAINED->name], true))
            ->values();

        if ($orders->isEmpty()) {
            throw new ResourceConflictException(__('None of the selected orders has a received deposit.'));
        }

        $remainingCents = $orders->mapWithKeys(fn(OrderDomainObject $order) => [
            $order->getId() => (int)round(($order->getDepositAmount() - $order->getDepositRetainedAmount()) * 100),
        ]);
        $availableCents = $remainingCents->sum();
        $amountCents = (int)round($amount * 100);

        if ($amountCents <= 0 || $amountCents > $availableCents) {
            throw new ResourceConflictException(__('The amount cannot exceed what is left of the selected deposits (:available).', [
                'available' => number_format($availableCents / 100, 2),
            ]));
        }

        $shares = $this->allocateCents($amountCents, $remainingCents->all());
        $note = trim(strip_tags($note));

        $updated = $this->databaseManager->transaction(fn() => $orders->map(
            fn(OrderDomainObject $order) => $this->orderRepository->updateFromArray($order->getId(), [
                'deposit_status' => OrderDepositStatus::RETAINED->name,
                'deposit_retained_amount' => Currency::round($order->getDepositRetainedAmount() + $shares[$order->getId()] / 100),
                'deposit_note' => trim(implode("\n", array_filter([$order->getDepositNote(), $note]))) ?: null,
                'deposit_resolved_at' => Carbon::now(),
            ])
        ));

        if ($notify) {
            $this->notifyBuyers($eventId, $updated);
        }

        return $updated;
    }

    /**
     * Un depot rendu au complet n'a plus de motif de retenue a afficher.
     */
    private function resolveNote(OrderDepositStatus $status, ?string $note, OrderDomainObject $order): ?string
    {
        if ($note !== null) {
            return trim(strip_tags($note)) ?: null;
        }

        return $status === OrderDepositStatus::RETURNED ? null : $order->getDepositNote();
    }

    /**
     * @param array<int, int> $weights
     * @return array<int, int>
     */
    private function allocateCents(int $amountCents, array $weights): array
    {
        $total = array_sum($weights);
        $shares = [];
        $fractions = [];

        foreach ($weights as $id => $weight) {
            $exact = $amountCents * $weight / $total;
            $shares[$id] = (int)floor($exact);
            $fractions[$id] = $exact - $shares[$id];
        }

        arsort($fractions);
        $leftover = $amountCents - array_sum($shares);
        foreach (array_keys($fractions) as $id) {
            if ($leftover <= 0) {
                break;
            }
            $shares[$id]++;
            $leftover--;
        }

        return $shares;
    }

    /**
     * @throws ResourceConflictException
     */
    private function findDepositOrder(int $eventId, int $orderId): OrderDomainObject
    {
        $order = $this->orderRepository->findFirstWhere(['event_id' => $eventId, 'id' => $orderId]);

        if (!$order || $order->getDepositAmount() <= 0) {
            throw new ResourceConflictException(__('This order has no deposit.'));
        }

        return $order;
    }

    /**
     * @param Collection<OrderDomainObject> $orders
     */
    private function notifyBuyers(int $eventId, Collection $orders): void
    {
        /** @var EventDomainObject $event */
        $event = $this->eventRepository
            ->loadRelation(new Relationship(OrganizerDomainObject::class, name: 'organizer'))
            ->loadRelation(new Relationship(EventSettingDomainObject::class))
            ->findById($eventId);

        foreach ($orders as $order) {
            $this->mailer
                ->to($order->getEmail())
                ->locale($order->getLocale())
                ->send(new OrderDepositResolved(
                    order: $order,
                    event: $event,
                    organizer: $event->getOrganizer(),
                    eventSettings: $event->getEventSettings(),
                ));
        }
    }
}
