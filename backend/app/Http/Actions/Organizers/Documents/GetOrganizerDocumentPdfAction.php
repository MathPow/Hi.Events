<?php

namespace HiEvents\Http\Actions\Organizers\Documents;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Document\OrganizerDocumentResource;
use HiEvents\Services\Application\Handlers\Organizer\Documents\OrganizerDocumentHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Domain\Document\DocumentPdfService;

/**
 * The blank document as a PDF: the editor's preview and export.
 */
class GetOrganizerDocumentPdfAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerDocumentHandler $handler,
        private readonly DocumentPdfService           $pdfService,
        private readonly OrganizerRepositoryInterface $organizerRepository,
    )
    {
    }

    public function __invoke(Request $request, int $organizerId, int $documentId): JsonResponse|Response
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        try {
            $document = $this->handler->get($organizerId, $documentId);
        } catch (ResourceNotFoundException $exception) {
            return $this->errorResponse($exception->getMessage(), Response::HTTP_NOT_FOUND);
        }

        $organizer = $this->organizerRepository->findById($organizerId);

        return response($this->pdfService->blank($document, $organizer->getName()), Response::HTTP_OK, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => sprintf('inline; filename="%s"', $this->pdfService->filename($document->getTitle())),
        ]);
    }
}
