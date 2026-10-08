<?php

namespace HiEvents\Services\Domain\Mail\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class EventEmailBrandingDTO extends BaseDataObject
{
    public function __construct(
        public readonly string  $accentColor,
        public readonly string  $accentTextColor,
        public readonly string  $backgroundColor,
        public readonly string  $fontFamily,
        public readonly ?string $fontStylesheetUrl,
        public readonly ?string $organizerName,
        public readonly ?string $organizerLogoUrl,
        public readonly ?string $eventCoverUrl,
        public readonly string  $platformLogoUrl,
        public readonly string  $platformUrl,
    )
    {
    }
}
