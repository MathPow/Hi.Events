<?php

namespace HiEvents\Http\Actions\Organizers\Messages;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Organizer\OrganizerMessageResource;
use HiEvents\Services\Application\Handlers\Organizer\Messages\OrganizerInboxHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GetOrganizerMessagesAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerInboxHandler $handler,
    )
    {
    }

    public function __invoke(Request $request, int $organizerId): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $messages = $this->handler->list(
            organizerId: $organizerId,
            page: (int)$request->query('page', 1),
            perPage: (int)$request->query('per_page', 20),
            unreadOnly: $request->boolean('unread'),
        );

        return $this->resourceResponse(
            resource: OrganizerMessageResource::class,
            data: $messages,
            meta: ['unread_count' => $this->handler->unreadCount($organizerId)],
        );
    }
}
