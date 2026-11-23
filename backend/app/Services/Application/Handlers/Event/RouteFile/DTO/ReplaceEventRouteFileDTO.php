<?php

namespace HiEvents\Services\Application\Handlers\Event\RouteFile\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;
use Illuminate\Http\UploadedFile;

class ReplaceEventRouteFileDTO extends BaseDataObject
{
    public function __construct(
        public readonly int          $eventId,
        public readonly int          $routeFileId,
        public readonly UploadedFile $file,
        public readonly ?string      $label = null,
    )
    {
    }
}
