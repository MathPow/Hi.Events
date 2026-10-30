<?php

namespace HiEvents\Http\Actions\Events;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Event\GetEventMapLocationHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class GetEventMapLocationPublicAction extends BaseAction
{
    public function __construct(
        private readonly GetEventMapLocationHandler $handler,
    )
    {
    }

    public function __invoke(int $eventId): Response|JsonResponse
    {
        $location = $this->handler->handle(
            eventId: $eventId,
            viewerAccountId: $this->isUserAuthenticated() ? $this->getAuthenticatedAccountId() : null,
        );

        if ($location === null) {
            return $this->notFoundResponse();
        }

        return $this->jsonResponse($location->toArray(), wrapInData: true);
    }
}
