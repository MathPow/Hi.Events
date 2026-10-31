<?php

namespace HiEvents\Http\Actions\Organizers\Messages;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Organizer\Messages\OrganizerInboxHandler;
use Illuminate\Http\Response;

class MarkAllOrganizerMessagesReadAction extends BaseAction
{
    public function __construct(
        private readonly OrganizerInboxHandler $handler,
    )
    {
    }

    public function __invoke(int $organizerId): Response
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $this->handler->markAllRead($organizerId);

        return $this->noContentResponse();
    }
}
