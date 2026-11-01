<?php

namespace HiEvents\Repository\Interfaces;

use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use Illuminate\Support\Collection;

/**
 * @extends RepositoryInterface<OrganizerDocumentDomainObject>
 */
interface OrganizerDocumentRepositoryInterface extends RepositoryInterface
{
    /**
     * An organizer's documents, the last modified first, with their linked events.
     *
     * @return Collection<int, OrganizerDocumentDomainObject>
     */
    public function findForOrganizer(int $organizerId): Collection;

    /**
     * One document of an organizer with its linked events, or null.
     */
    public function findOneForOrganizer(int $organizerId, int $documentId): ?OrganizerDocumentDomainObject;

    /**
     * The documents linked to an event, in their creation order, with their linked events.
     *
     * @return Collection<int, OrganizerDocumentDomainObject>
     */
    public function findForEvent(int $eventId): Collection;

    /**
     * Links the document to exactly these events.
     *
     * @param int[] $eventIds
     */
    public function syncEvents(int $documentId, array $eventIds): void;
}
