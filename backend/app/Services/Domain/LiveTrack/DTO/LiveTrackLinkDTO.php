<?php

namespace HiEvents\Services\Domain\LiveTrack\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

class LiveTrackLinkDTO extends BaseDataObject
{
    public function __construct(
        public readonly string $sessionId,
        public readonly string $token,
    )
    {
    }

    public function url(): string
    {
        return sprintf('https://livetrack.garmin.com/session/%s/token/%s', $this->sessionId, $this->token);
    }
}
