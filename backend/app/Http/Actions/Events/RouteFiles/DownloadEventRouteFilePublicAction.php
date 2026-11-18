<?php

namespace HiEvents\Http\Actions\Events\RouteFiles;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Event\RouteFile\DownloadEventRouteFilePublicHandler;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DownloadEventRouteFilePublicAction extends BaseAction
{
    public function __construct(
        private readonly DownloadEventRouteFilePublicHandler $handler,
    )
    {
    }

    public function __invoke(int $eventId, int $routeFileId): StreamedResponse
    {
        $download = $this->handler->handle($eventId, $routeFileId);

        return $this->streamedFileResponse(
            stream: $download->stream,
            mimeType: 'application/gpx+xml',
            contentDisposition: $download->contentDisposition,
            size: $download->size,
        );
    }
}
