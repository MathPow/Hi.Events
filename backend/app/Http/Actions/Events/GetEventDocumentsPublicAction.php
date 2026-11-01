<?php

namespace HiEvents\Http\Actions\Events;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Repository\Interfaces\OrganizerDocumentRepositoryInterface;
use HiEvents\Resources\Document\OrganizerDocumentResourcePublic;
use Illuminate\Http\JsonResponse;

/**
 * The organizer's documents linked to an event, for the checkout: the online
 * ones are signed there, the others are mentioned (they come with the ticket).
 */
class GetEventDocumentsPublicAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerDocumentRepositoryInterface $documentRepository,
    )
    {
    }

    public function __invoke(int $eventId): JsonResponse
    {
        return $this->resourceResponse(
            OrganizerDocumentResourcePublic::class,
            $this->documentRepository->findForEvent($eventId),
        );
    }
}
