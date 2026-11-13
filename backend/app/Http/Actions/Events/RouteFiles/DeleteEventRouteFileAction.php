<?php

namespace HiEvents\Http\Actions\Events\RouteFiles;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DeleteEventRouteFileHandler;
use Illuminate\Http\Response;

class DeleteEventRouteFileAction extends BaseAction
{
    public function __construct(
        private readonly DeleteEventRouteFileHandler $handler,
    )
    {
    }

    public function __invoke(int $eventId, int $routeFileId): Response
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        $this->handler->handle($eventId, $routeFileId);

        return $this->deletedResponse();
    }
}
