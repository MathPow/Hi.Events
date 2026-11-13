<?php

namespace HiEvents\Http\Actions\Events\RouteFiles;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Event\RouteFile\EventRouteFileResource;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DTO\UpdateEventRouteFileDTO;
use HiEvents\Services\Application\Handlers\Event\RouteFile\UpdateEventRouteFileHandler;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class UpdateEventRouteFileAction extends BaseAction
{
    public function __construct(
        private readonly UpdateEventRouteFileHandler $handler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request, int $eventId, int $routeFileId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        $validated = $this->validate($request, [
            'label' => 'required|string|max:' . EventRouteFileService::LABEL_MAX_LENGTH,
        ]);

        return $this->resourceResponse(EventRouteFileResource::class, $this->handler->handle(new UpdateEventRouteFileDTO(
            eventId: $eventId,
            routeFileId: $routeFileId,
            label: $validated['label'],
        )));
    }
}
