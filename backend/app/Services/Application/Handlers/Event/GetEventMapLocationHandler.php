<?php

namespace HiEvents\Services\Application\Handlers\Event;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\Status\EventStatus;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\Account\AccountSuspensionService;
use HiEvents\Services\Domain\Event\EventLocationCoordinatesService;
use HiEvents\Services\Infrastructure\Geocoding\DTO\GeocodedLocationDTO;

/**
 * Les coordonnees de la carte « Emplacement » d'une page d'evenement: pour un evenement en
 * ligne, ou pour son organisateur qui en regarde l'apercu.
 */
class GetEventMapLocationHandler
{
    public function __construct(
        private readonly EventRepositoryInterface        $eventRepository,
        private readonly AccountSuspensionService        $accountSuspensionService,
        private readonly EventLocationCoordinatesService $coordinatesService,
    )
    {
    }

    public function handle(int $eventId, ?int $viewerAccountId): ?GeocodedLocationDTO
    {
        /** @var EventDomainObject $event */
        $event = $this->eventRepository
            ->loadRelation(new Relationship(EventSettingDomainObject::class))
            ->findById($eventId);

        $isOwner = $viewerAccountId !== null && $viewerAccountId === $event->getAccountId();
        $isVisible = $event->getStatus() === EventStatus::LIVE->name
            && !$this->accountSuspensionService->isSuspended($event->getAccountId());

        if ((!$isVisible && !$isOwner) || $event->getEventSettings() === null) {
            return null;
        }

        return $this->coordinatesService->getCoordinates($event->getEventSettings());
    }
}
