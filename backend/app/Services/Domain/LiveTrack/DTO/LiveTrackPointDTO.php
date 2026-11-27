<?php

namespace HiEvents\Services\Domain\LiveTrack\DTO;

use Carbon\CarbonImmutable;
use HiEvents\DataTransferObjects\BaseDataObject;

class LiveTrackPointDTO extends BaseDataObject
{
    public function __construct(
        public readonly CarbonImmutable $recordedAt,
        public readonly float           $latitude,
        public readonly float           $longitude,
        public readonly ?float          $altitudeM = null,
        public readonly ?float          $speedMps = null,
        public readonly ?float          $distanceM = null,
        public readonly ?int            $durationS = null,
        public readonly ?float          $elevationGainM = null,
        public readonly ?int            $heartRate = null,
        public readonly ?int            $cadence = null,
        public readonly bool            $isEnd = false,
    )
    {
    }
}
