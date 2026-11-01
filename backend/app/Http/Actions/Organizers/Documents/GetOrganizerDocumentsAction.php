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
 * The organizer's documents, the last modified first.
 */
class GetOrganizerDocumentsAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerDocumentHandler $handler,
    )
    {
    }

    public function __invoke(Request $request, int $organizerId): JsonResponse|Response
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        return $this->resourceResponse(OrganizerDocumentResource::class, $this->handler->list($organizerId));
    }
}
