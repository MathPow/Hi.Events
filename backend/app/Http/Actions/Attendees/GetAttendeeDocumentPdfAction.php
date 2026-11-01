<?php

namespace HiEvents\Http\Actions\Attendees;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\Document\DocumentPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

/**
 * The PDF of an attendee's copy of a document, as signed (or to print).
 */
class GetAttendeeDocumentPdfAction extends BaseAction
{
    public function __construct(
        private readonly DocumentSignatureRepositoryInterface $documentSignatureRepository,
        private readonly EventRepositoryInterface             $eventRepository,
        private readonly DocumentPdfService                   $pdfService,
    )
    {
    }

    public function __invoke(int $eventId, int $attendeeId, int $documentId): Response|JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        $copy = $this->documentSignatureRepository->findFirstWhere([
            'id' => $documentId,
            'event_id' => $eventId,
            'attendee_id' => $attendeeId,
        ]);

        if (!$copy) {
            return $this->notFoundResponse();
        }

        $event = $this->eventRepository->findById($eventId);

        return response($this->pdfService->copy($copy, $event->getTimezone()), Response::HTTP_OK, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf(
                'inline; filename="%s"',
                $this->pdfService->filename($copy->getTitle(), $copy->getAutoValues()['participant_name'] ?? null),
            ),
        ]);
    }
}
