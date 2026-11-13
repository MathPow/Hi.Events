<?php

namespace HiEvents\Services\Domain\EventChange;

use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\EventChangeRefundDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrderDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Mail\EventChange\EventCancelledMail;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventCancellationRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\EventChange\DTO\EventOrderRefundOutcomeDTO;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Database\DatabaseManager;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * One order of a cancelled event (its own queued job): cancelled first, under the order's lock, then
 * refunded when the organizer asked for it. A refund that fails leaves the order cancelled and is
 * recorded for the organizer to do by hand; an order already cancelled or refunded is left alone.
 * Then its buyer gets the organizer's message with what happens to their money.
 */
class EventCancellationOrderService
{
    public function __construct(
        private readonly EventChangeRefundRepositoryInterface $eventChangeRefundRepository,
        private readonly EventCancellationRepositoryInterface $eventCancellationRepository,
        private readonly EventRepositoryInterface             $eventRepository,
        private readonly EventOrderRefundService              $eventOrderRefundService,
        private readonly DatabaseManager                      $databaseManager,
        private readonly Mailer                               $mailer,
        private readonly LoggerInterface                      $logger,
    )
    {
    }

    public function process(int $eventChangeRefundId): EventChangeRefundStatus
    {
        /** @var EventChangeRefundDomainObject|null $record */
        $record = $this->eventChangeRefundRepository->findFirstWhere([
            EventChangeRefundDomainObjectAbstract::ID => $eventChangeRefundId,
        ]);

        if ($record === null || $record->getStatus() !== EventChangeRefundStatus::PENDING->name) {
            return $record ? EventChangeRefundStatus::fromName($record->getStatus()) : EventChangeRefundStatus::SKIPPED;
        }

        /** @var EventCancellationDomainObject $cancellation */
        $cancellation = $this->eventCancellationRepository->findById($record->getEventCancellationId());

        try {
            $order = $this->cancelOrder($record);
        } catch (Throwable $exception) {
            $this->logger->error('Cancelled event: the order could not be cancelled', [
                'order_id' => $record->getOrderId(),
                'event_id' => $record->getEventId(),
                'exception' => $exception->getMessage(),
            ]);

            $this->finish($record, new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::FAILED, error: $exception->getMessage()));
            $this->notifyBuyerAfterFailure($record, $cancellation);

            return EventChangeRefundStatus::FAILED;
        }

        if ($order === null) {
            return $this->finish($record, new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::SKIPPED));
        }

        $outcome = $this->refund($order, $cancellation);
        $this->finish($record, $outcome);
        $this->notifyBuyer($order, $cancellation, $outcome);

        return $outcome->status;
    }

    /**
     * The order, cancelled; null when it was already cancelled or refunded.
     *
     * @throws Throwable
     */
    private function cancelOrder(EventChangeRefundDomainObject $record): ?OrderDomainObject
    {
        return $this->databaseManager->transaction(function () use ($record) {
            $this->eventOrderRefundService->lockOrder($record->getOrderId());

            $order = $this->eventOrderRefundService->findOrder([
                OrderDomainObjectAbstract::EVENT_ID => $record->getEventId(),
                OrderDomainObjectAbstract::ID => $record->getOrderId(),
            ]);

            if ($order === null || $this->eventOrderRefundService->isAlreadySettled($order)) {
                return null;
            }

            $this->eventOrderRefundService->cancel($order, notifyBuyer: false);

            return $order;
        });
    }

    private function refund(OrderDomainObject $order, EventCancellationDomainObject $cancellation): EventOrderRefundOutcomeDTO
    {
        if ($this->eventOrderRefundService->isUnpaid($order)) {
            return new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::CANCELLED_NO_PAYMENT);
        }

        $amount = $this->eventOrderRefundService->refundableAmount($order);

        if (!$cancellation->getRefundOrders()) {
            return new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::NOT_REFUNDED, $amount);
        }

        try {
            return $this->eventOrderRefundService->refund($order, notifyBuyer: false);
        } catch (Throwable $exception) {
            $this->logger->error('Cancelled event: the order was cancelled but could not be refunded', [
                'order_id' => $order->getId(),
                'event_id' => $order->getEventId(),
                'exception' => $exception->getMessage(),
            ]);

            return new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::FAILED, $amount, $exception->getMessage());
        }
    }

    private function finish(EventChangeRefundDomainObject $record, EventOrderRefundOutcomeDTO $outcome): EventChangeRefundStatus
    {
        $this->eventChangeRefundRepository->updateWhere(
            attributes: [
                EventChangeRefundDomainObjectAbstract::STATUS => $outcome->status->name,
                EventChangeRefundDomainObjectAbstract::AMOUNT => $outcome->amount,
                EventChangeRefundDomainObjectAbstract::ERROR => $outcome->error !== null ? mb_substr($outcome->error, 0, 1000) : null,
            ],
            where: [EventChangeRefundDomainObjectAbstract::ID => $record->getId()],
        );

        return $outcome->status;
    }

    private function notifyBuyerAfterFailure(EventChangeRefundDomainObject $record, EventCancellationDomainObject $cancellation): void
    {
        $order = $this->eventOrderRefundService->findOrder([
            OrderDomainObjectAbstract::EVENT_ID => $record->getEventId(),
            OrderDomainObjectAbstract::ID => $record->getOrderId(),
        ]);

        if ($order === null) {
            return;
        }

        $this->notifyBuyer($order, $cancellation, $this->eventOrderRefundService->isUnpaid($order)
            ? new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::CANCELLED_NO_PAYMENT)
            : new EventOrderRefundOutcomeDTO(EventChangeRefundStatus::FAILED, $this->eventOrderRefundService->refundableAmount($order)));
    }

    private function notifyBuyer(OrderDomainObject $order, EventCancellationDomainObject $cancellation, EventOrderRefundOutcomeDTO $outcome): void
    {
        $event = $this->eventRepository
            ->loadRelation(new Relationship(OrganizerDomainObject::class, name: 'organizer'))
            ->loadRelation(EventSettingDomainObject::class)
            ->findById($order->getEventId());

        $this->mailer
            ->to($order->getEmail(), $order->getFullName())
            ->locale($order->getLocale())
            ->send(new EventCancelledMail(
                event: $event,
                organizer: $event->getOrganizer(),
                eventSettings: $event->getEventSettings(),
                cancellation: $cancellation,
                firstName: $order->getFirstName() ?: null,
                refundStatus: $outcome->status,
                refundAmount: $outcome->amount,
            ));
    }
}
