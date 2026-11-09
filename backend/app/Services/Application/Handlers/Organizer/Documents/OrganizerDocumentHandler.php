<?php

namespace HiEvents\Services\Application\Handlers\Organizer\Documents;

use HiEvents\DomainObjects\Enums\DocumentAudience;
use HiEvents\DomainObjects\Enums\DocumentSigningMode;
use HiEvents\DomainObjects\Generated\OrganizerDocumentDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerDocumentDomainObject;
use HiEvents\Repository\Interfaces\OrganizerDocumentRepositoryInterface;
use HiEvents\Services\Domain\Document\DocumentBlocks;
use HiEvents\Services\Domain\Document\DocumentTemplates;
use HiEvents\Services\Domain\Document\Import\ImportedDocument;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Throwable;

/**
 * The Documents page of an organizer: its documents, made from a template or
 * blank, edited block by block (saved as they change) and linked to events.
 */
class OrganizerDocumentHandler
{
    public const TITLE_MAX_LENGTH = 150;

    public function __construct(
        private readonly OrganizerDocumentRepositoryInterface $documentRepository,
        private readonly DatabaseManager                      $databaseManager,
    )
    {
    }

    /**
     * @return Collection<int, OrganizerDocumentDomainObject>
     */
    public function list(int $organizerId): Collection
    {
        return $this->documentRepository->findForOrganizer($organizerId);
    }

    public function get(int $organizerId, int $documentId): OrganizerDocumentDomainObject
    {
        return $this->documentRepository->findOneForOrganizer($organizerId, $documentId)
            ?? throw new ResourceNotFoundException(__('Document not found'));
    }

    /**
     * @throws ValidationException
     */
    public function create(int $organizerId, ?string $template, string $locale): OrganizerDocumentDomainObject
    {
        $made = DocumentTemplates::make($template ?? DocumentTemplates::BLANK, $locale);

        $document = $this->documentRepository->create([
            OrganizerDocumentDomainObjectAbstract::ORGANIZER_ID => $organizerId,
            OrganizerDocumentDomainObjectAbstract::TITLE => $made['title'],
            OrganizerDocumentDomainObjectAbstract::BLOCKS => DocumentBlocks::normalize($made['blocks']),
            OrganizerDocumentDomainObjectAbstract::SIGNING_MODE => DocumentSigningMode::ONLINE->value,
            OrganizerDocumentDomainObjectAbstract::AUDIENCE => $made['audience'],
            OrganizerDocumentDomainObjectAbstract::TEMPLATE => $template,
        ]);

        return $this->get($organizerId, $document->getId());
    }

    /**
     * A document rebuilt from the organizer's PDF.
     *
     * @throws ValidationException
     */
    public function createImported(int $organizerId, ImportedDocument $imported): OrganizerDocumentDomainObject
    {
        $document = $this->documentRepository->create([
            OrganizerDocumentDomainObjectAbstract::ORGANIZER_ID => $organizerId,
            OrganizerDocumentDomainObjectAbstract::TITLE => mb_substr($imported->title, 0, self::TITLE_MAX_LENGTH),
            OrganizerDocumentDomainObjectAbstract::BLOCKS => DocumentBlocks::normalize($imported->blocks),
            OrganizerDocumentDomainObjectAbstract::SIGNING_MODE => DocumentSigningMode::ONLINE->value,
            OrganizerDocumentDomainObjectAbstract::AUDIENCE => DocumentAudience::from($imported->audience)->value,
            OrganizerDocumentDomainObjectAbstract::TEMPLATE => null,
        ]);

        return $this->get($organizerId, $document->getId());
    }

    /**
     * Saves what changed: any of title, blocks, signing_mode, audience, audience_age, event_ids.
     *
     * @throws ValidationException|Throwable
     */
    public function update(int $organizerId, int $documentId, array $changes): OrganizerDocumentDomainObject
    {
        $document = $this->get($organizerId, $documentId);
        $attributes = [];

        if (array_key_exists('title', $changes)) {
            $title = mb_substr(trim((string)$changes['title']), 0, self::TITLE_MAX_LENGTH);
            if ($title === '') {
                throw ValidationException::withMessages(['title' => __('The document needs a name.')]);
            }
            $attributes[OrganizerDocumentDomainObjectAbstract::TITLE] = $title;
        }

        if (array_key_exists('blocks', $changes)) {
            $attributes[OrganizerDocumentDomainObjectAbstract::BLOCKS] = DocumentBlocks::normalize($changes['blocks']);
        }

        if (array_key_exists('signing_mode', $changes)) {
            $attributes[OrganizerDocumentDomainObjectAbstract::SIGNING_MODE] = DocumentSigningMode::from($changes['signing_mode'])->value;
        }

        if (array_key_exists('audience', $changes)) {
            $attributes[OrganizerDocumentDomainObjectAbstract::AUDIENCE] = DocumentAudience::from($changes['audience'])->value;
        }

        if (array_key_exists('audience_age', $changes)) {
            $attributes[OrganizerDocumentDomainObjectAbstract::AUDIENCE_AGE] = $changes['audience_age'] === null ? null : (int)$changes['audience_age'];
        }

        $eventIds = array_key_exists('event_ids', $changes)
            ? $this->organizerEventIds($organizerId, (array)$changes['event_ids'])
            : null;

        $this->databaseManager->transaction(function () use ($document, $attributes, $eventIds) {
            // Saved even with nothing new, so "modified on" follows the last change of events too.
            // Through the model, for the JSON cast of the blocks.
            $this->documentRepository->updateFromArray(
                $document->getId(),
                [...$attributes, OrganizerDocumentDomainObjectAbstract::UPDATED_AT => now()],
            );

            if ($eventIds !== null) {
                $this->documentRepository->syncEvents($document->getId(), $eventIds);
            }
        });

        return $this->get($organizerId, $documentId);
    }

    /**
     * A copy named "… (copie)", linked to no event.
     *
     * @throws ValidationException
     */
    public function duplicate(int $organizerId, int $documentId): OrganizerDocumentDomainObject
    {
        $document = $this->get($organizerId, $documentId);

        $copy = $this->documentRepository->create([
            OrganizerDocumentDomainObjectAbstract::ORGANIZER_ID => $organizerId,
            OrganizerDocumentDomainObjectAbstract::TITLE => mb_substr(__(':title (copy)', ['title' => $document->getTitle()]), 0, self::TITLE_MAX_LENGTH),
            OrganizerDocumentDomainObjectAbstract::BLOCKS => DocumentBlocks::normalize($document->getBlocks()),
            OrganizerDocumentDomainObjectAbstract::SIGNING_MODE => $document->getSigningMode(),
            OrganizerDocumentDomainObjectAbstract::AUDIENCE => $document->getAudience(),
            OrganizerDocumentDomainObjectAbstract::AUDIENCE_AGE => $document->getAudienceAge(),
            OrganizerDocumentDomainObjectAbstract::TEMPLATE => $document->getTemplate(),
        ]);

        return $this->get($organizerId, $copy->getId());
    }

    /**
     * Copies already signed stay with their attendees.
     */
    public function delete(int $organizerId, int $documentId): void
    {
        $document = $this->get($organizerId, $documentId);

        $this->documentRepository->deleteById($document->getId());
    }

    /**
     * Only the organizer's own events.
     *
     * @return int[]
     * @throws ValidationException
     */
    private function organizerEventIds(int $organizerId, array $eventIds): array
    {
        $eventIds = array_values(array_unique(array_filter(array_map('intval', $eventIds))));
        if ($eventIds === []) {
            return [];
        }

        $owned = $this->databaseManager->table('events')
            ->where('organizer_id', $organizerId)
            ->whereNull('deleted_at')
            ->whereIn('id', $eventIds)
            ->pluck('id')
            ->map(fn($id) => (int)$id)
            ->all();

        if (count($owned) !== count($eventIds)) {
            throw ValidationException::withMessages(['event_ids' => __('Event not found')]);
        }

        return $owned;
    }
}
