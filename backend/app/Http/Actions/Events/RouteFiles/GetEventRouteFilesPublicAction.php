<?php

namespace HiEvents\Http\Actions\Events\RouteFiles;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Event\RouteFile\EventRouteFileResourcePublic;
use HiEvents\Services\Application\Handlers\Event\RouteFile\GetEventRouteFilesPublicHandler;
use Illuminate\Http\JsonResponse;

/**
 * The courses participants download from their ticket.
 */
class GetEventRouteFilesPublicAction extends BaseAction
{
    public function __construct(
        private readonly GetEventRouteFilesPublicHandler $handler,
    )
    {
    }

    public function __invoke(int $eventId): JsonResponse
    {
        return $this->resourceResponse(EventRouteFileResourcePublic::class, $this->handler->handle($eventId));
    }
}
