<?php

namespace HiEvents\Services\Application\Handlers\Attendee\Public;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Generated\AttendeeDomainObjectAbstract;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\Exceptions\CannotCheckInException;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Services\Application\Handlers\CheckInList\Public\GetCheckInListAttendeePublicHandler;
use HiEvents\Services\Domain\Waiver\DTO\PendingSignaturesDTO;
use HiEvents\Services\Domain\Waiver\PendingSignatureService;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

/**
 * A participant's signatures left after checkout: read and signed from their
 * ticket's link, or at the door on the volunteer's device.
 */
class ParticipantSignaturesHandler
{
    public function __construct(
        private readonly AttendeeRepositoryInterface         $attendeeRepository,
        private readonly EventRepositoryInterface            $eventRepository,
        private readonly EventSettingsRepositoryInterface    $eventSettingsRepository,
        private readonly GetCheckInListAttendeePublicHandler $checkInListAttendeeHandler,
        private readonly PendingSignatureService             $pendingSignatureService,
    )
    {
    }

    public function pendingForTicket(int $eventId, string $attendeeShortId): PendingSignaturesDTO
    {
        return $this->pending($this->ticketAttendee($eventId, $attendeeShortId));
    }

    /**
     * @throws ValidationException
     */
    public function signForTicket(int $eventId, string $attendeeShortId, array $input, ?string $ipAddress): void
    {
        $this->sign($this->ticketAttendee($eventId, $attendeeShortId), $input, $ipAddress);
    }

    /**
     * @throws CannotCheckInException
     */
    public function pendingForCheckIn(string $checkInListShortId, string $attendeePublicId): PendingSignaturesDTO
    {
        return $this->pending($this->checkInAttendee($checkInListShortId, $attendeePublicId));
    }

    /**
     * @throws CannotCheckInException|ValidationException
     */
    public function signForCheckIn(string $checkInListShortId, string $attendeePublicId, array $input, ?string $ipAddress): void
    {
        $this->sign($this->checkInAttendee($checkInListShortId, $attendeePublicId), $input, $ipAddress);
    }

    private function pending(AttendeeDomainObject $attendee): PendingSignaturesDTO
    {
        return $this->pendingSignatureService->pending(
            $attendee,
            $this->eventRepository->findById($attendee->getEventId()),
            $this->eventSettingsRepository->findFirstWhere(['event_id' => $attendee->getEventId()]),
        );
    }

    private function sign(AttendeeDomainObject $attendee, array $input, ?string $ipAddress): void
    {
        $this->pendingSignatureService->sign(
            $attendee,
            $this->eventRepository->findById($attendee->getEventId()),
            $this->eventSettingsRepository->findFirstWhere(['event_id' => $attendee->getEventId()]),
            $input,
            $ipAddress,
        );
    }

    private function ticketAttendee(int $eventId, string $attendeeShortId): AttendeeDomainObject
    {
        $attendee = $this->attendeeRepository->findFirstWhere([
            AttendeeDomainObjectAbstract::SHORT_ID => $attendeeShortId,
            AttendeeDomainObjectAbstract::EVENT_ID => $eventId,
        ]);

        if (!$attendee || $attendee->getStatus() === AttendeeStatus::CANCELLED->name) {
            throw new ResourceNotFoundException(__('Attendee not found'));
        }

        return $attendee;
    }

    /**
     * @throws CannotCheckInException
     */
    private function checkInAttendee(string $checkInListShortId, string $attendeePublicId): AttendeeDomainObject
    {
        $attendee = $this->checkInListAttendeeHandler->handle($checkInListShortId, $attendeePublicId);

        if ($attendee->getStatus() === AttendeeStatus::CANCELLED->name) {
            throw new ResourceNotFoundException(__('Attendee not found'));
        }

        return $attendee;
    }
}
