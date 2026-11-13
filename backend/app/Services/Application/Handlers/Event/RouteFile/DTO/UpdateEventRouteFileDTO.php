<?php

namespace HiEvents\Services\Application\Handlers\Event\RouteFile\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class UpdateEventRouteFileDTO extends BaseDataObject
{
    public function __construct(
        public readonly int    $eventId,
        public readonly int    $routeFileId,
        public readonly string $label,
    )
    {
    }
}
