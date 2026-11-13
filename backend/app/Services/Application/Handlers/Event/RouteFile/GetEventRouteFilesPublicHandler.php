<?php

namespace HiEvents\Services\Application\Handlers\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use Illuminate\Support\Collection;

class GetEventRouteFilesPublicHandler
{
    public function __construct(
        private readonly EventRepositoryInterface $eventRepository,
        private readonly EventRouteFileService    $routeFileService,
    )
    {
    }

    /**
     * @return Collection<int, EventRouteFileDomainObject>
     * @throws ResourceNotFoundException
     */
    public function handle(int $eventId): Collection
    {
        if ($this->eventRepository->findFirst($eventId) === null) {
            throw new ResourceNotFoundException(__('Event not found'));
        }

        return $this->routeFileService->forEvent($eventId);
    }
}
