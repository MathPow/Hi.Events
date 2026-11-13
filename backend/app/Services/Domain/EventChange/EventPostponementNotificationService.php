<?php

namespace HiEvents\Services\Domain\EventChange;

use Carbon\Carbon;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Mail\EventChange\EventPostponedMail;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use Illuminate\Contracts\Mail\Mailer;

/**
 * Tells everyone about a postponed event: one email per order to its buyer (with the refund link when
 * the order was paid online and refunds are offered), one to each other participant. The emails are
 * queued.
 */
class EventPostponementNotificationService
{
    public function __construct(
        private readonly EventRepositoryInterface           $eventRepository,
        private readonly EventDateChangeRepositoryInterface $eventDateChangeRepository,
        private readonly EventChangeRecipientService        $recipientService,
        private readonly EventOrderRefundService            $eventOrderRefundService,
        private readonly RefundRequestTokenService          $tokenService,
        private readonly Mailer                             $mailer,
    )
    {
    }

    public function notify(int $dateChangeId): int
    {
        /** @var EventDateChangeDomainObject $dateChange */
        $dateChange = $this->eventDateChangeRepository->findById($dateChangeId);

        $event = $this->eventRepository
            ->loadRelation(new Relationship(OrganizerDomainObject::class, name: 'organizer'))
            ->loadRelation(EventSettingDomainObject::class)
            ->findById($dateChange->getEventId());

        $recipients = $this->recipientService->forEvent($event->getId());

        $recipients->orders->each(fn(OrderDomainObject $order) => $this->send(
            event: $event,
            dateChange: $dateChange,
            email: $order->getEmail(),
            name: $order->getFullName(),
            firstName: $order->getFirstName(),
            locale: $order->getLocale(),
            refundUrl: $this->offersRefund($dateChange, $order) ? $this->tokenService->url($order, $dateChange) : null,
        ));

        $recipients->attendees->each(fn(AttendeeDomainObject $attendee) => $this->send(
            event: $event,
            dateChange: $dateChange,
            email: $attendee->getEmail(),
            name: trim($attendee->getFirstName() . ' ' . $attendee->getLastName()),
            firstName: $attendee->getFirstName(),
            locale: $attendee->getLocale(),
            refundUrl: null,
        ));

        return $recipients->count();
    }

    public function offersRefund(EventDateChangeDomainObject $dateChange, OrderDomainObject $order): bool
    {
        return $dateChange->getRefundsAllowed()
            && $dateChange->getRefundDeadline() !== null
            && Carbon::parse($dateChange->getRefundDeadline(), 'UTC')->isFuture()
            && $order->isOrderCompleted()
            && $this->eventOrderRefundService->isPaidOnline($order)
            && !$this->eventOrderRefundService->isAlreadySettled($order);
    }

    private function send(
        EventDomainObject           $event,
        EventDateChangeDomainObject $dateChange,
        string                      $email,
        string                      $name,
        ?string                     $firstName,
        ?string                     $locale,
        ?string                     $refundUrl,
    ): void
    {
        $this->mailer
            ->to($email, $name)
            ->locale($locale)
            ->send(new EventPostponedMail(
                event: $event,
                organizer: $event->getOrganizer(),
                eventSettings: $event->getEventSettings(),
                dateChange: $dateChange,
                firstName: $firstName ?: null,
                refundUrl: $refundUrl,
            ));
    }
}
