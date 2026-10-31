<?php

namespace HiEvents\Http\Actions\Organizers\Messages;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Organizer\Messages\OrganizerInboxHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

class DeleteOrganizerMessageAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerInboxHandler $handler,
    )
    {
    }

    public function __invoke(int $organizerId, int $messageId): Response|JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        try {
            $this->handler->delete($organizerId, $messageId);
        } catch (ResourceNotFoundException $exception) {
            return $this->errorResponse($exception->getMessage(), 404);
        }

        return $this->deletedResponse();
    }
}
