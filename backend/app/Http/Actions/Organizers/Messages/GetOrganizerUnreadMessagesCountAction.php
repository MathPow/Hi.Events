<?php

namespace HiEvents\Http\Actions\Organizers\Messages;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Organizer\Messages\OrganizerInboxHandler;
use Illuminate\Http\JsonResponse;

/**
 * Le nombre de messages non lus: la pastille du menu, relue toutes les minutes.
 */
class GetOrganizerUnreadMessagesCountAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerInboxHandler $handler,
    )
    {
    }

    public function __invoke(int $organizerId): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        return $this->jsonResponse(['unread_count' => $this->handler->unreadCount($organizerId)]);
    }
}
