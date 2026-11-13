<?php

namespace HiEvents\Services\Domain\Attendee\Transfer;

use Carbon\CarbonImmutable;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\TicketTransferRefusal;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeCheckInDomainObjectAbstract;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Exceptions\TicketTransferNotAllowedException;
use HiEvents\Repository\Interfaces\AttendeeCheckInRepositoryInterface;
use HiEvents\Services\Domain\Attendee\Transfer\DTO\TicketTransferEligibilityDTO;

/**
 * When a participant may give their ticket to someone else: the event allows it, the order is
 * paid, the ticket is valid and unused, and the event starts later than the organizer's cutoff.
 */
class TicketTransferPolicy
{
    public function __construct(
        private readonly AttendeeCheckInRepositoryInterface $attendeeCheckInRepository,
    )
    {
    }

    public function eligibility(
        AttendeeDomainObject      $attendee,
        OrderDomainObject         $order,
        EventDomainObject         $event,
        ?EventSettingDomainObject $settings,
    ): TicketTransferEligibilityDTO
    {
        $enabled = $settings !== null && $settings->getAllowTicketTransfer();
        $deadline = $enabled ? $this->deadline($event, $settings) : null;

        return new TicketTransferEligibilityDTO(
            enabled: $enabled,
            deadline: $deadline?->setTimezone('UTC')->toDateTimeString(),
            refusal: $enabled ? $this->refusal($attendee, $order, $deadline) : TicketTransferRefusal::DISABLED,
        );
    }

    /**
     * @throws TicketTransferNotAllowedException
     */
    public function assertCanTransfer(
        AttendeeDomainObject      $attendee,
        OrderDomainObject         $order,
        EventDomainObject         $event,
        ?EventSettingDomainObject $settings,
        string                    $newEmail,
    ): void
    {
        $refusal = $this->eligibility($attendee, $order, $event, $settings)->refusal;

        if ($refusal !== null) {
            throw new TicketTransferNotAllowedException($refusal);
        }

        if ($this->normalize($newEmail) === $this->normalize($attendee->getEmail())) {
            throw new TicketTransferNotAllowedException(TicketTransferRefusal::SAME_EMAIL);
        }
    }

    /**
     * The cutoff counts back from the start in the event's timezone: « 7 days before » keeps the
     * time of day across a daylight saving change.
     */
    public function deadline(EventDomainObject $event, EventSettingDomainObject $settings): ?CarbonImmutable
    {
        if (!$event->getStartDate()) {
            return null;
        }

        $start = CarbonImmutable::parse($event->getStartDate(), 'UTC')->setTimezone($event->getTimezone() ?: 'UTC');
        $hours = $settings->getTicketTransferCutoffHours();

        return $hours % 24 === 0 ? $start->subDays(intdiv($hours, 24)) : $start->subHours($hours);
    }

    private function refusal(AttendeeDomainObject $attendee, OrderDomainObject $order, ?CarbonImmutable $deadline): ?TicketTransferRefusal
    {
        if ($attendee->getStatus() === AttendeeStatus::CANCELLED->name) {
            return TicketTransferRefusal::TICKET_NOT_ACTIVE;
        }

        if ($order->getStatus() !== OrderStatus::COMPLETED->name
            || $attendee->getStatus() === AttendeeStatus::AWAITING_PAYMENT->name) {
            return TicketTransferRefusal::ORDER_NOT_COMPLETED;
        }

        if ($attendee->getStatus() !== AttendeeStatus::ACTIVE->name) {
            return TicketTransferRefusal::TICKET_NOT_ACTIVE;
        }

        if ($deadline !== null && !CarbonImmutable::now()->lessThan($deadline)) {
            return TicketTransferRefusal::DEADLINE_PASSED;
        }

        if ($this->isCheckedIn($attendee)) {
            return TicketTransferRefusal::CHECKED_IN;
        }

        return null;
    }

    private function isCheckedIn(AttendeeDomainObject $attendee): bool
    {
        return $attendee->getCheckedInAt() !== null
            || $this->attendeeCheckInRepository->countWhere([
                AttendeeCheckInDomainObjectAbstract::ATTENDEE_ID => $attendee->getId(),
            ]) > 0;
    }

    private function normalize(?string $email): string
    {
        return mb_strtolower(trim((string)$email));
    }
}
