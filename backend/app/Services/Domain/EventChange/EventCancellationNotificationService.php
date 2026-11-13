<?php

namespace HiEvents\Services\Domain\EventChange;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\EventChangeRefundDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Jobs\EventChange\CancelEventOrderJob;
use HiEvents\Mail\EventChange\EventCancelledMail;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventCancellationRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Contracts\Mail\Mailer;

/**
 * Right after an event is cancelled: the participants who did not buy get the organizer's message
 * (before their orders are cancelled, so none is missed), then one job per order cancels, refunds and
 * writes to its buyer.
 */
class EventCancellationNotificationService
{
    public function __construct(
        private readonly EventCancellationRepositoryInterface $eventCancellationRepository,
        private readonly EventChangeRefundRepositoryInterface $eventChangeRefundRepository,
        private readonly EventRepositoryInterface             $eventRepository,
        private readonly EventChangeRecipientService          $recipientService,
        private readonly Mailer                               $mailer,
        private readonly Dispatcher                           $dispatcher,
    )
    {
    }

    public function start(int $cancellationId): void
    {
        /** @var EventCancellationDomainObject $cancellation */
        $cancellation = $this->eventCancellationRepository->findById($cancellationId);

        $event = $this->eventRepository
            ->loadRelation(new Relationship(OrganizerDomainObject::class, name: 'organizer'))
            ->loadRelation(EventSettingDomainObject::class)
            ->findById($cancellation->getEventId());

        $this->recipientService->forEvent($event->getId())->attendees
            ->each(fn(AttendeeDomainObject $attendee) => $this->mailer
                ->to($attendee->getEmail(), trim($attendee->getFirstName() . ' ' . $attendee->getLastName()))
                ->locale($attendee->getLocale())
                ->send(new EventCancelledMail(
                    event: $event,
                    organizer: $event->getOrganizer(),
                    eventSettings: $event->getEventSettings(),
                    cancellation: $cancellation,
                    firstName: $attendee->getFirstName() ?: null,
                )));

        $this->eventChangeRefundRepository
            ->findWhere([
                EventChangeRefundDomainObjectAbstract::EVENT_CANCELLATION_ID => $cancellation->getId(),
                EventChangeRefundDomainObjectAbstract::STATUS => EventChangeRefundStatus::PENDING->name,
            ])
            ->each(fn(EventChangeRefundDomainObject $refund) => $this->dispatcher->dispatch(
                new CancelEventOrderJob($refund->getId()),
            ));
    }
}
