<?php

namespace HiEvents\Services\Application\Handlers\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DTO\RouteFileDownloadDTO;
use HiEvents\Services\Domain\Event\RouteFile\RouteFileDownloadName;
use Illuminate\Filesystem\FilesystemManager;
use Throwable;

class DownloadEventRouteFilePublicHandler
{
    public function __construct(
        private readonly EventRepositoryInterface          $eventRepository,
        private readonly EventRouteFileRepositoryInterface $routeFileRepository,
        private readonly FilesystemManager                 $filesystemManager,
        private readonly RouteFileDownloadName             $downloadName,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function handle(int $eventId, int $routeFileId): RouteFileDownloadDTO
    {
        /** @var EventRouteFileDomainObject|null $routeFile */
        $routeFile = $this->eventRepository->findFirst($eventId) === null ? null : $this->routeFileRepository->findFirstWhere([
            EventRouteFileDomainObject::ID => $routeFileId,
            EventRouteFileDomainObject::EVENT_ID => $eventId,
        ]);

        if ($routeFile === null) {
            throw new ResourceNotFoundException(__('Route file not found'));
        }

        $disk = $this->filesystemManager->disk($routeFile->getDisk());

        try {
            $stream = $disk->readStream($routeFile->getPath());
        } catch (Throwable) {
            $stream = null;
        }

        if (!is_resource($stream)) {
            throw new ResourceNotFoundException(__('Route file not found'));
        }

        return new RouteFileDownloadDTO(
            stream: $stream,
            size: $routeFile->getSize(),
            contentDisposition: $this->downloadName->contentDisposition($routeFile->getLabel()),
        );
    }
}
