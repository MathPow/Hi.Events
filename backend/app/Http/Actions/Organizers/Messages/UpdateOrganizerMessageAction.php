<?php

namespace HiEvents\Http\Actions\Organizers\Messages;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Organizer\OrganizerMessageResource;
use HiEvents\Services\Application\Handlers\Organizer\Messages\OrganizerInboxHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

/**
 * Marque un message lu (ou de nouveau non lu).
 */
class UpdateOrganizerMessageAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerInboxHandler $handler,
    )
    {
    }

    public function __invoke(Request $request, int $organizerId, int $messageId): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $data = $this->validate($request, ['read' => 'required|boolean']);

        try {
            $message = $this->handler->setRead($organizerId, $messageId, (bool)$data['read']);
        } catch (ResourceNotFoundException $exception) {
            return $this->errorResponse($exception->getMessage(), 404);
        }

        return $this->resourceResponse(OrganizerMessageResource::class, $message);
    }
}
