<?php

namespace HiEvents\Http\Actions\Organizers\Achievements;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\OrganizerNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Organizer\Achievements\MarkOrganizerAchievementsSeenHandler;
use Illuminate\Http\Response;

class MarkOrganizerAchievementsSeenAction extends BaseAction
{
    public function __construct(
        private readonly MarkOrganizerAchievementsSeenHandler $handler,
    )
    {
    }

    /**
     * @throws OrganizerNotFoundException
     */
    public function __invoke(int $organizerId): Response
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $this->handler->handle($organizerId, $this->getAuthenticatedAccountId());

        return $this->noContentResponse();
    }
}
