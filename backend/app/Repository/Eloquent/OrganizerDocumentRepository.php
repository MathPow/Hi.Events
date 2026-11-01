<?php

namespace HiEvents\Repository\Eloquent;

use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\Models\OrganizerDocument;
use HiEvents\Repository\Interfaces\OrganizerDocumentRepositoryInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * @extends BaseRepository<OrganizerDocumentDomainObject>
 */
class OrganizerDocumentRepository extends BaseRepository implements OrganizerDocumentRepositoryInterface
{
    private const PIVOT = 'event_organizer_document';

    protected function getModel(): string
    {
        return OrganizerDocument::class;
    }

    public function getDomainObject(): string
    {
        return OrganizerDocumentDomainObject::class;
    }

    public function findForOrganizer(int $organizerId): Collection
    {
        $this->model = $this->model
            ->where('organizer_id', $organizerId)
            ->orderByDesc('updated_at')
            ->orderByDesc('id');

        $results = $this->model->get();
        $this->resetModel();

        return $this->withEventIds($this->handleResults($results));
    }

    public function findOneForOrganizer(int $organizerId, int $documentId): ?OrganizerDocumentDomainObject
    {
        $document = $this->findFirstWhere([
            'id' => $documentId,
            'organizer_id' => $organizerId,
        ]);

        return $document ? $this->withEventIds(collect([$document]))->first() : null;
    }

    public function findForEvent(int $eventId): Collection
    {
        $this->model = $this->model
            ->whereIn('id', DB::table(self::PIVOT)->select('organizer_document_id')->where('event_id', $eventId))
            ->orderBy('id');

        $results = $this->model->get();
        $this->resetModel();

        return $this->withEventIds($this->handleResults($results));
    }

    public function syncEvents(int $documentId, array $eventIds): void
    {
        $eventIds = array_values(array_unique(array_map('intval', $eventIds)));

        DB::table(self::PIVOT)
            ->where('organizer_document_id', $documentId)
            ->when($eventIds, fn($query) => $query->whereNotIn('event_id', $eventIds))
            ->delete();

        $now = now();
        DB::table(self::PIVOT)->insertOrIgnore(array_map(static fn(int $eventId) => [
            'organizer_document_id' => $documentId,
            'event_id' => $eventId,
            'created_at' => $now,
            'updated_at' => $now,
        ], $eventIds));
    }

    /**
     * @param Collection<int, OrganizerDocumentDomainObject> $documents
     * @return Collection<int, OrganizerDocumentDomainObject>
     */
    private function withEventIds(Collection $documents): Collection
    {
        if ($documents->isEmpty()) {
            return $documents;
        }

        $links = DB::table(self::PIVOT)
            ->join('events', 'events.id', '=', self::PIVOT . '.event_id')
            ->whereNull('events.deleted_at')
            ->whereIn('organizer_document_id', $documents->map(fn($document) => $document->getId())->all())
            ->orderBy('event_id')
            ->get(['organizer_document_id', 'event_id'])
            ->groupBy('organizer_document_id');

        return $documents->each(fn(OrganizerDocumentDomainObject $document) => $document->setEventIds(
            ($links->get($document->getId()) ?? collect())->pluck('event_id')->all()
        ));
    }
}
