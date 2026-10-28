<?php

namespace HiEvents\Http\Actions\Organizers\Achievements;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\OrganizerNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Organizer\Achievements\GetOrganizerAchievementsHandler;
use Illuminate\Http\JsonResponse;

class GetOrganizerAchievementsAction extends BaseAction
{
    public function __construct(
        private readonly GetOrganizerAchievementsHandler $handler,
    )
    {
    }

    /**
     * @throws OrganizerNotFoundException
     */
    public function __invoke(int $organizerId): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        return $this->jsonResponse(
            data: $this->handler->handle($organizerId, $this->getAuthenticatedAccountId()),
            wrapInData: true,
        );
    }
}
