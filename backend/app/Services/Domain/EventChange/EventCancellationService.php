<?php

namespace HiEvents\Services\Domain\EventChange;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Generated\EventCancellationDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\EventChangeRefundDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Exceptions\EventChangeNotAllowedException;
use HiEvents\Repository\Interfaces\EventCancellationRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\CancelEventDTO;
use HiEvents\Services\Domain\EventChange\DTO\EventChangeRecipientsDTO;

/**
 * « Annuler l'événement »: marks the event cancelled (no more sales, a banner on its page), keeps
 * the message and the refund choice, and lines up every order still standing for its job. The caller
 * holds the transaction.
 */
class EventCancellationService
{
    public function __construct(
        private readonly EventRepositoryInterface             $eventRepository,
        private readonly EventCancellationRepositoryInterface $eventCancellationRepository,
        private readonly EventChangeRefundRepositoryInterface $eventChangeRefundRepository,
    )
    {
    }

    /**
     * @throws EventChangeNotAllowedException
     */
    public function cancel(EventDomainObject $event, CancelEventDTO $dto, EventChangeRecipientsDTO $recipients): EventCancellationDomainObject
    {
        if ($event->isCancelled()) {
            throw new EventChangeNotAllowedException(__('This event is already cancelled.'));
        }

        $this->eventRepository->updateWhere(
            attributes: [EventDomainObjectAbstract::CANCELLED_AT => Carbon::now('UTC')->format('Y-m-d H:i:s')],
            where: [EventDomainObjectAbstract::ID => $event->getId()],
        );

        $cancellation = $this->eventCancellationRepository->create([
            EventCancellationDomainObjectAbstract::EVENT_ID => $event->getId(),
            EventCancellationDomainObjectAbstract::USER_ID => $dto->userId,
            EventCancellationDomainObjectAbstract::MESSAGE => trim($dto->message),
            EventCancellationDomainObjectAbstract::REFUND_ORDERS => $dto->refundOrders,
            EventCancellationDomainObjectAbstract::RECIPIENTS_COUNT => $recipients->count(),
        ]);

        $existing = $this->eventChangeRefundRepository
            ->findWhereIn(
                EventChangeRefundDomainObjectAbstract::ORDER_ID,
                $recipients->orders->map(fn(OrderDomainObject $order) => $order->getId())->values()->all() ?: [0],
            )
            ->map(fn($refund) => $refund->getOrderId())
            ->flip();

        $recipients->orders
            ->reject(fn(OrderDomainObject $order) => $existing->has($order->getId()))
            ->each(fn(OrderDomainObject $order) => $this->eventChangeRefundRepository->create([
                EventChangeRefundDomainObjectAbstract::EVENT_ID => $event->getId(),
                EventChangeRefundDomainObjectAbstract::ORDER_ID => $order->getId(),
                EventChangeRefundDomainObjectAbstract::EVENT_CANCELLATION_ID => $cancellation->getId(),
                EventChangeRefundDomainObjectAbstract::STATUS => EventChangeRefundStatus::PENDING->name,
                EventChangeRefundDomainObjectAbstract::CURRENCY => $order->getCurrency(),
            ]));

        return $cancellation;
    }
}
