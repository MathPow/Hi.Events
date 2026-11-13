<?php

namespace HiEvents\Services\Application\Handlers\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\CouldNotStoreRouteFileException;
use HiEvents\Exceptions\InvalidRouteFileException;
use HiEvents\Exceptions\RouteFileLimitReachedException;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DTO\UploadEventRouteFileDTO;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use HiEvents\Services\Domain\Event\RouteFile\GpxFileValidator;

class UploadEventRouteFileHandler
{
    public function __construct(
        private readonly EventRouteFileRepositoryInterface $routeFileRepository,
        private readonly EventRouteFileService             $routeFileService,
        private readonly GpxFileValidator                  $gpxFileValidator,
    )
    {
    }

    /**
     * @throws RouteFileLimitReachedException
     * @throws InvalidRouteFileException
     * @throws CouldNotStoreRouteFileException
     */
    public function handle(UploadEventRouteFileDTO $dto): EventRouteFileDomainObject
    {
        $count = $this->routeFileRepository->countWhere([EventRouteFileDomainObject::EVENT_ID => $dto->eventId]);

        if ($count >= EventRouteFileService::MAX_FILES_PER_EVENT) {
            throw new RouteFileLimitReachedException(__('An event can have up to :count GPX files.', [
                'count' => EventRouteFileService::MAX_FILES_PER_EVENT,
            ]));
        }

        $this->gpxFileValidator->validate($dto->file);

        return $this->routeFileService->store($dto->eventId, $dto->file, $dto->label);
    }
}
