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

/**
 * One of the organizer's documents.
 */
class GetOrganizerDocumentAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerDocumentHandler $handler,
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

        return $this->resourceResponse(OrganizerDocumentResource::class, $document);
    }
}
