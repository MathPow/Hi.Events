<?php

namespace HiEvents\Services\Domain\Event\RouteFile;

use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Exceptions\CouldNotStoreRouteFileException;
use HiEvents\Helper\StringHelper;
use HiEvents\Repository\Eloquent\Value\OrderAndDirection;
use HiEvents\Repository\Interfaces\EventRouteFileRepositoryInterface;
use Illuminate\Config\Repository;
use Illuminate\Filesystem\FilesystemManager;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * The GPX courses of an event, kept on the public disk under events/{eventId}/routes/, as uploaded.
 */
class EventRouteFileService
{
    public const MAX_FILES_PER_EVENT = 5;

    public const LABEL_MAX_LENGTH = 100;

    // On object storage, a direct link to the file downloads it instead of showing it as XML.
    private const STORAGE_OPTIONS = [
        'ContentType' => 'application/octet-stream',
        'ContentDisposition' => 'attachment',
    ];

    public function __construct(
        private readonly EventRouteFileRepositoryInterface $routeFileRepository,
        private readonly FilesystemManager                 $filesystemManager,
        private readonly Repository                        $config,
        private readonly LoggerInterface                   $logger,
    )
    {
    }

    /**
     * @return Collection<int, EventRouteFileDomainObject>
     */
    public function forEvent(int $eventId): Collection
    {
        return $this->routeFileRepository->findWhere(
            where: [EventRouteFileDomainObject::EVENT_ID => $eventId],
            orderAndDirections: [new OrderAndDirection(EventRouteFileDomainObject::ID, 'asc')],
        );
    }

    /**
     * @throws CouldNotStoreRouteFileException
     */
    public function store(int $eventId, UploadedFile $file, ?string $label): EventRouteFileDomainObject
    {
        $disk = $this->config->get('filesystems.public');
        $originalFilename = (string)$file->getClientOriginalName();

        $path = $this->filesystemManager->disk($disk)->putFileAs(
            path: $this->directory($eventId),
            file: $file,
            name: Str::uuid() . '.gpx',
            options: self::STORAGE_OPTIONS,
        );

        if ($path === false) {
            $this->logger->error('Could not store event route file', [
                'disk' => $disk,
                'event_id' => $eventId,
                'original_filename' => $originalFilename,
            ]);

            throw new CouldNotStoreRouteFileException(__('The GPX file could not be saved. Please try again.'));
        }

        return $this->routeFileRepository->create([
            EventRouteFileDomainObject::EVENT_ID => $eventId,
            EventRouteFileDomainObject::LABEL => $this->cleanLabel($label, $originalFilename),
            EventRouteFileDomainObject::ORIGINAL_FILENAME => Str::limit(StringHelper::stripControlCharacters($originalFilename), 255, ''),
            EventRouteFileDomainObject::DISK => $disk,
            EventRouteFileDomainObject::PATH => $path,
            EventRouteFileDomainObject::SIZE => (int)$file->getSize(),
        ]);
    }

    /**
     * The label as typed, else the file's name without its extension (« 10 km.gpx » gives « 10 km »).
     */
    public function cleanLabel(?string $label, string $originalFilename = ''): string
    {
        $clean = static fn(string $value): string => Str::limit(
            trim(preg_replace('/\s+/u', ' ', StringHelper::stripControlCharacters($value)) ?? ''),
            self::LABEL_MAX_LENGTH,
            '',
        );

        $value = $clean($label ?? '');
        if ($value === '') {
            $value = $clean(pathinfo($originalFilename, PATHINFO_FILENAME));
        }

        return $value === '' ? __('Route') : $value;
    }

    /**
     * Each course gets its own copy on disk, so deleting it from one event leaves the other alone.
     * A file missing on disk is skipped rather than failing the whole duplication.
     */
    public function duplicateForEvent(int $sourceEventId, int $targetEventId): void
    {
        foreach ($this->forEvent($sourceEventId) as $routeFile) {
            $newPath = $this->directory($targetEventId) . '/' . Str::uuid() . '.gpx';

            try {
                $disk = $this->filesystemManager->disk($routeFile->getDisk());
                $copied = $disk->exists($routeFile->getPath()) && $disk->copy($routeFile->getPath(), $newPath);
            } catch (Throwable $exception) {
                $copied = false;
                $this->logger->warning('Could not copy event route file', ['exception' => $exception->getMessage()]);
            }

            if (!$copied) {
                $this->logger->warning('Event route file not copied to the duplicated event', [
                    'route_file_id' => $routeFile->getId(),
                    'source_event_id' => $sourceEventId,
                    'target_event_id' => $targetEventId,
                ]);
                continue;
            }

            $this->routeFileRepository->create([
                EventRouteFileDomainObject::EVENT_ID => $targetEventId,
                EventRouteFileDomainObject::LABEL => $routeFile->getLabel(),
                EventRouteFileDomainObject::ORIGINAL_FILENAME => $routeFile->getOriginalFilename(),
                EventRouteFileDomainObject::DISK => $routeFile->getDisk(),
                EventRouteFileDomainObject::PATH => $newPath,
                EventRouteFileDomainObject::SIZE => $routeFile->getSize(),
            ]);
        }
    }

    private function directory(int $eventId): string
    {
        return 'events/' . $eventId . '/routes';
    }
}
