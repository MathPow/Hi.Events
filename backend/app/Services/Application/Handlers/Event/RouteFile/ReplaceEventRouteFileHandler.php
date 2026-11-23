<?php

namespace HiEvents\Services\Application\Handlers\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\CouldNotStoreRouteFileException;
use HiEvents\Exceptions\InvalidRouteFileException;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DTO\ReplaceEventRouteFileDTO;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use HiEvents\Services\Domain\Event\RouteFile\GpxFileValidator;

/**
 * A course edited in the course maker: the new GPX takes the place of the old one, under the same id.
 */
class ReplaceEventRouteFileHandler
{
    public function __construct(
        private readonly EventRouteFileRepositoryInterface $routeFileRepository,
        private readonly EventRouteFileService             $routeFileService,
        private readonly GpxFileValidator                  $gpxFileValidator,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     * @throws InvalidRouteFileException
     * @throws CouldNotStoreRouteFileException
     */
    public function handle(ReplaceEventRouteFileDTO $dto): EventRouteFileDomainObject
    {
        /** @var EventRouteFileDomainObject|null $routeFile */
        $routeFile = $this->routeFileRepository->findFirstWhere([
            EventRouteFileDomainObject::ID => $dto->routeFileId,
            EventRouteFileDomainObject::EVENT_ID => $dto->eventId,
        ]);

        if ($routeFile === null) {
            throw new ResourceNotFoundException(__('Route file not found'));
        }

        $this->gpxFileValidator->validate($dto->file);

        return $this->routeFileService->replace($routeFile, $dto->file, $dto->label);
    }
}
