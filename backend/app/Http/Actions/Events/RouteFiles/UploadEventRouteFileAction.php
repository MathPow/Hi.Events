<?php

namespace HiEvents\Http\Actions\Events\RouteFiles;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\CouldNotStoreRouteFileException;
use HiEvents\Exceptions\InvalidRouteFileException;
use HiEvents\Exceptions\RouteFileLimitReachedException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Resources\Event\RouteFile\EventRouteFileResource;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DTO\UploadEventRouteFileDTO;
use HiEvents\Services\Application\Handlers\Event\RouteFile\UploadEventRouteFileHandler;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use HiEvents\Services\Domain\Event\RouteFile\GpxFileValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class UploadEventRouteFileAction extends BaseAction
{
    public function __construct(
        private readonly UploadEventRouteFileHandler $handler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request, int $eventId): JsonResponse
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
            $routeFile = $this->handler->handle(new UploadEventRouteFileDTO(
                eventId: $eventId,
                file: $request->file('file'),
                label: $request->input('label'),
            ));
        } catch (InvalidRouteFileException|RouteFileLimitReachedException|CouldNotStoreRouteFileException $exception) {
            throw ValidationException::withMessages(['file' => $exception->getMessage()]);
        }

        return $this->resourceResponse(EventRouteFileResource::class, $routeFile, ResponseCodes::HTTP_CREATED);
    }
}
