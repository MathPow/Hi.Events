<?php

namespace HiEvents\Services\Domain\Mail\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

/**
 * What a participant email shows of the event and its organizer, like the public event page:
 * the organizer's color, logo and name, the cover, the title, the date and the place.
 */
class EventEmailBrandingDTO extends BaseDataObject
{
    public function __construct(
        public readonly string  $accentColor,
        public readonly string  $accentSoftColor,
        public readonly string  $accentDeepColor,
        public readonly string  $accentTextColor,
        public readonly ?string $organizerName,
        public readonly ?string $organizerLogoUrl,
        public readonly string  $eventTitle,
        public readonly ?string $eventUrl,
        public readonly ?string $eventCoverUrl,
        public readonly ?string $dateLine,
        public readonly ?string $timezoneLine,
        public readonly ?string $placeLine,
        public readonly ?string $addressLine,
        public readonly ?string $supportEmail,
        public readonly string  $assetsUrl,
        public readonly string  $platformLogoUrl,
        public readonly string  $platformUrl,
    )
    {
    }
}
