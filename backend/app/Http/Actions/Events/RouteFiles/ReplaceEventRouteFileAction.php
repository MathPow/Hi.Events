<?php

namespace HiEvents\Http\Actions\Events\RouteFiles;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\CouldNotStoreRouteFileException;
use HiEvents\Exceptions\InvalidRouteFileException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Event\RouteFile\EventRouteFileResource;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DTO\ReplaceEventRouteFileDTO;
use HiEvents\Services\Application\Handlers\Event\RouteFile\ReplaceEventRouteFileHandler;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use HiEvents\Services\Domain\Event\RouteFile\GpxFileValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ReplaceEventRouteFileAction extends BaseAction
{
    public function __construct(
        private readonly ReplaceEventRouteFileHandler $handler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request, int $eventId, int $routeFileId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        $this->validate($request, [
            'file' => 'required|file|max:' . GpxFileValidator::MAX_KILOBYTES,
            'label' => 'nullable|string|max:' . EventRouteFileService::LABEL_MAX_LENGTH,
        ], [
            'file.required' => __('Choose a GPX file.'),
            'file.file' => __('Choose a GPX file.'),
            'file.uploaded' => __('The GPX file must be 10 MB or less.'),
            'file.max' => __('The GPX file must be 10 MB or less.'),
        ]);

        try {
            $routeFile = $this->handler->handle(new ReplaceEventRouteFileDTO(
                eventId: $eventId,
                routeFileId: $routeFileId,
                file: $request->file('file'),
                label: $request->input('label'),
            ));
        } catch (InvalidRouteFileException|CouldNotStoreRouteFileException $exception) {
            throw ValidationException::withMessages(['file' => $exception->getMessage()]);
        }

        return $this->resourceResponse(EventRouteFileResource::class, $routeFile);
    }
}
