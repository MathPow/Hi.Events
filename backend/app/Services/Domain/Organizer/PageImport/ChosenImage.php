<?php

namespace HiEvents\Services\Domain\Organizer\PageImport;

use HiEvents\DataTransferObjects\BaseDataObject;

class ChosenImage extends BaseDataObject
{
    public function __construct(
        public readonly string $url,
        public readonly string $mimeType,
        public readonly int    $width,
        public readonly int    $height,
        public readonly string $bytes,
    )
    {
    }
}
