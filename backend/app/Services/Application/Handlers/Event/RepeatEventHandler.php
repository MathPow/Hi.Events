<?php

namespace HiEvents\Services\Application\Handlers\Event;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\Exceptions\RecurringEventValidationException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerDocumentRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\DTO\RepeatEventDTO;
use HiEvents\Services\Application\Handlers\Event\DTO\RepeatEventResultDTO;
use HiEvents\Services\Domain\Event\DuplicateEventService;
use HiEvents\Services\Domain\Event\RecurringEvent\DTO\EventOccurrenceDTO;
use HiEvents\Services\Domain\Event\RecurringEvent\RecurringEventDateService;
use Illuminate\Database\DatabaseManager;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * « Répéter cet événement »: one full copy of the event per chosen date, one after the other,
 * all in the event's series, with the event's documents to sign. Stops at the first date that
 * fails and says which ones were created.
 */
class RepeatEventHandler
{
    public function __construct(
        private readonly EventRepositoryInterface             $eventRepository,
        private readonly DuplicateEventService                $duplicateEventService,
        private readonly RecurringEventDateService            $recurringEventDateService,
        private readonly OrganizerDocumentRepositoryInterface $organizerDocumentRepository,
        private readonly DatabaseManager                      $databaseManager,
        private readonly LoggerInterface                      $logger,
    )
    {
    }

    /**
     * @throws RecurringEventValidationException
     * @throws ResourceNotFoundException
     */
    public function handle(RepeatEventDTO $data): RepeatEventResultDTO
    {
        /** @var EventDomainObject|null $event */
        $event = $this->eventRepository->findFirstWhere([
            EventDomainObjectAbstract::ID => $data->eventId,
            EventDomainObjectAbstract::ACCOUNT_ID => $data->accountId,
        ]);

        if ($event === null) {
            throw new ResourceNotFoundException(__('Event not found'));
        }

        $occurrences = $this->recurringEventDateService->buildOccurrences($event, $data->dates);
        $seriesId = $event->getSeriesId() ?? $event->getId();
        $createdEvents = collect();

        foreach ($occurrences as $occurrence) {
            try {
                $createdEvents->push($this->createOccurrence($event, $occurrence, $seriesId));
            } catch (Throwable $exception) {
                $this->logger->error('Repeating an event stopped at a date that could not be created', [
                    'event_id' => $event->getId(),
                    'date' => $occurrence->date,
                    'created_count' => $createdEvents->count(),
                    'exception' => $exception,
                ]);

                return new RepeatEventResultDTO(createdEvents: $createdEvents, failedDate: $occurrence->date);
            }
        }

        return new RepeatEventResultDTO(createdEvents: $createdEvents);
    }

    /**
     * @throws Throwable
     */
    private function createOccurrence(EventDomainObject $event, EventOccurrenceDTO $occurrence, int $seriesId): EventDomainObject
    {
        $this->databaseManager->beginTransaction();

        try {
            $newEvent = $this->duplicateEventService->duplicateEvent(
                eventId: $event->getId(),
                accountId: $event->getAccountId(),
                title: $event->getTitle(),
                startDate: $occurrence->startDate,
                description: $event->getDescription(),
                endDate: $occurrence->endDate,
                shiftRelatedDates: true,
            );

            $this->eventRepository->updateWhere(
                attributes: [
                    EventDomainObjectAbstract::SERIES_ID => $seriesId,
                    EventDomainObjectAbstract::STATUS => $event->getStatus(),
                ],
                where: [EventDomainObjectAbstract::ID => $newEvent->getId()],
            );

            $this->organizerDocumentRepository->findForEvent($event->getId())
                ->each(fn(OrganizerDocumentDomainObject $document) => $this->organizerDocumentRepository->syncEvents(
                    $document->getId(),
                    [...$document->getEventIds(), $newEvent->getId()],
                ));

            if ($event->getSeriesId() === null) {
                $this->eventRepository->updateWhere(
                    attributes: [EventDomainObjectAbstract::SERIES_ID => $seriesId],
                    where: [EventDomainObjectAbstract::ID => $event->getId()],
                );
            }

            $this->databaseManager->commit();
        } catch (Throwable $exception) {
            $this->databaseManager->rollBack();
            throw $exception;
        }

        $event->setSeriesId($seriesId);

        return $newEvent
            ->setSeriesId($seriesId)
            ->setStatus($event->getStatus());
    }
}
