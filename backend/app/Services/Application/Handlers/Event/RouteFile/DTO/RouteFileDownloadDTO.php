<?php

namespace HiEvents\Services\Application\Handlers\Event\RouteFile\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class RouteFileDownloadDTO extends BaseDataObject
{
    /**
     * @param resource $stream
     */
    public function __construct(
        public readonly mixed  $stream,
        public readonly ?int   $size,
        public readonly string $contentDisposition,
    )
    {
    }
}
