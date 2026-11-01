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
use HiEvents\Services\Domain\Document\DocumentTemplates;

/**
 * A new document, from a starting template or blank.
 */
class CreateOrganizerDocumentAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerDocumentHandler $handler,
    )
    {
    }

    public function __invoke(Request $request, int $organizerId): JsonResponse|Response
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $data = $this->validate($request, [
            'template' => 'nullable|string|in:' . implode(',', DocumentTemplates::KEYS),
        ]);

        $document = $this->handler->create(
            $organizerId,
            $data['template'] ?? null,
            $this->getAuthenticatedUser()->getLocale(),
        );

        return $this->resourceResponse(OrganizerDocumentResource::class, $document, Response::HTTP_CREATED);
    }
}
