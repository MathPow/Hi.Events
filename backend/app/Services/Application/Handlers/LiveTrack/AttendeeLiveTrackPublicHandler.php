<?php

namespace HiEvents\Services\Application\Handlers\LiveTrack;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\LiveTrackDomainObject;
use HiEvents\DomainObjects\Status\AttendeeStatus;
use HiEvents\Exceptions\InvalidLiveTrackLinkException;
use HiEvents\Exceptions\LiveTrackingDisabledException;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventSettingsRepositoryInterface;
use HiEvents\Services\Application\Handlers\LiveTrack\DTO\AttendeeLiveTrackDTO;
use HiEvents\Services\Domain\LiveTrack\LiveTrackService;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

/**
 * The participant shares their Garmin LiveTrack link from their ticket's page, or stops sharing it.
 */
class AttendeeLiveTrackPublicHandler
{
    public function __construct(
        private readonly AttendeeRepositoryInterface      $attendeeRepository,
        private readonly EventSettingsRepositoryInterface $eventSettingsRepository,
        private readonly LiveTrackService                 $liveTrackService,
    )
    {
    }

    public function get(int $eventId, string $attendeeShortId): AttendeeLiveTrackDTO
    {
        $attendee = $this->findAttendee($eventId, $attendeeShortId);

        return new AttendeeLiveTrackDTO(
            enabled: $this->isEnabled($eventId),
            liveTrack: $this->liveTrackService->forAttendee($attendee),
        );
    }

    /**
     * @throws InvalidLiveTrackLinkException|LiveTrackingDisabledException
     */
    public function share(int $eventId, string $attendeeShortId, string $link): LiveTrackDomainObject
    {
        $attendee = $this->findAttendee($eventId, $attendeeShortId);
        if (!$this->isEnabled($eventId)) {
            throw new LiveTrackingDisabledException(__('Live tracking is not offered for this event.'));
        }

        return $this->liveTrackService->share($attendee, $link);
    }

    public function remove(int $eventId, string $attendeeShortId): void
    {
        $this->liveTrackService->remove($this->findAttendee($eventId, $attendeeShortId));
    }

    private function isEnabled(int $eventId): bool
    {
        /** @var EventSettingDomainObject|null $settings */
        $settings = $this->eventSettingsRepository->findFirstWhere([EventSettingDomainObject::EVENT_ID => $eventId]);

        return (bool)$settings?->getLiveTrackingEnabled();
    }

    private function findAttendee(int $eventId, string $attendeeShortId): AttendeeDomainObject
    {
        $attendee = $this->attendeeRepository->findFirstWhere([
            AttendeeDomainObject::SHORT_ID => $attendeeShortId,
            AttendeeDomainObject::EVENT_ID => $eventId,
        ]);

        if (!$attendee || $attendee->getStatus() === AttendeeStatus::CANCELLED->name) {
            throw new ResourceNotFoundException(__('Attendee not found'));
        }

        return $attendee;
    }
}
