<?php

namespace HiEvents\Services\Application\Handlers\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;

/**
 * Soft-deletes the course: it leaves the ticket and the settings at once, its file stays on disk.
 */
class DeleteEventRouteFileHandler
{
    public function __construct(
        private readonly EventRouteFileRepositoryInterface $routeFileRepository,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function handle(int $eventId, int $routeFileId): void
    {
        $deleted = $this->routeFileRepository->deleteWhere([
            EventRouteFileDomainObject::ID => $routeFileId,
            EventRouteFileDomainObject::EVENT_ID => $eventId,
        ]);

        if ($deleted === 0) {
            throw new ResourceNotFoundException(__('Route file not found'));
        }
    }
}
