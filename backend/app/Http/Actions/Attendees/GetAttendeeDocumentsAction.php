<?php

namespace HiEvents\Http\Actions\Attendees;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Resources\Document\DocumentSignatureResource;
use Illuminate\Http\JsonResponse;

/**
 * An attendee's copies of the organizer's documents: signed online or to print.
 */
class GetAttendeeDocumentsAction extends BaseAction
{
    public function __construct(
        private readonly DocumentSignatureRepositoryInterface $documentSignatureRepository,
    )
    {
    }

    public function __invoke(int $eventId, int $attendeeId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        return $this->resourceResponse(
            DocumentSignatureResource::class,
            $this->documentSignatureRepository->findWhere([
                'event_id' => $eventId,
                'attendee_id' => $attendeeId,
            ])->sortBy(fn($copy) => $copy->getId())->values(),
        );
    }
}
