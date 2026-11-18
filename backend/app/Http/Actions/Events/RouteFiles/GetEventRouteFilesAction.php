<?php

namespace HiEvents\Http\Actions\Events\RouteFiles;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Event\RouteFile\EventRouteFileResource;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use Illuminate\Http\JsonResponse;

class GetEventRouteFilesAction extends BaseAction
{
    public function __construct(
        private readonly EventRouteFileService $routeFileService,
    )
    {
    }

    public function __invoke(int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        return $this->resourceResponse(
            EventRouteFileResource::class,
            $this->routeFileService->forEvent($eventId),
        );
    }
}
