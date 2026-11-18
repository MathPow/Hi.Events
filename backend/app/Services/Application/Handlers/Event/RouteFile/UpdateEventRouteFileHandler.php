<?php

namespace HiEvents\Services\Application\Handlers\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DTO\UpdateEventRouteFileDTO;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;

class UpdateEventRouteFileHandler
{
    public function __construct(
        private readonly EventRouteFileRepositoryInterface $routeFileRepository,
        private readonly EventRouteFileService             $routeFileService,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function handle(UpdateEventRouteFileDTO $dto): EventRouteFileDomainObject
    {
        /** @var EventRouteFileDomainObject|null $routeFile */
        $routeFile = $this->routeFileRepository->findFirstWhere([
            EventRouteFileDomainObject::ID => $dto->routeFileId,
            EventRouteFileDomainObject::EVENT_ID => $dto->eventId,
        ]);

        if ($routeFile === null) {
            throw new ResourceNotFoundException(__('Route file not found'));
        }

        return $this->routeFileRepository->updateFromArray($routeFile->getId(), [
            EventRouteFileDomainObject::LABEL => $this->routeFileService->cleanLabel($dto->label, $routeFile->getOriginalFilename()),
        ]);
    }
}
