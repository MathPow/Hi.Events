<?php

namespace HiEvents\Resources\LiveTrack;

use HiEvents\DomainObjects\LiveTrackPointDomainObject;
use HiEvents\Resources\BaseResource;
use Illuminate\Http\Request;

/**
 * @mixin LiveTrackPointDomainObject
 */
class LiveTrackPointResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'recorded_at' => $this->getRecordedAt(),
            'latitude' => $this->getLatitude(),
            'longitude' => $this->getLongitude(),
            'altitude_m' => $this->getAltitudeM(),
            'heart_rate' => $this->getHeartRate(),
        ];
    }
}
