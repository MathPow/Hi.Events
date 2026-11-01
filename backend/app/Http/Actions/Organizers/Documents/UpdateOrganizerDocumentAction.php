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
 * Saves what changed in the editor, as it changes.
 */
class UpdateOrganizerDocumentAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerDocumentHandler $handler,
    )
    {
    }

    public function __invoke(Request $request, int $organizerId, int $documentId): JsonResponse|Response
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $data = $this->validate($request, [
            'title' => 'sometimes|string|max:150',
            'blocks' => 'sometimes|array',
            'signing_mode' => 'sometimes|string|in:ONLINE,PRINT',
            'audience' => 'sometimes|string|in:ALL,MINORS',
            'event_ids' => 'sometimes|array|max:500',
            'event_ids.*' => 'integer',
        ]);

        // The blocks whole: validate() only keeps the keys its rules name.
        if ($request->has('blocks')) {
            $data['blocks'] = $request->input('blocks');
        }

        try {
            $document = $this->handler->update($organizerId, $documentId, $data);
        } catch (ResourceNotFoundException $exception) {
            return $this->errorResponse($exception->getMessage(), Response::HTTP_NOT_FOUND);
        }

        return $this->resourceResponse(OrganizerDocumentResource::class, $document);
    }
}
