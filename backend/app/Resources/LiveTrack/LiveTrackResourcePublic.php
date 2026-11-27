<?php

namespace HiEvents\Resources\LiveTrack;

use HiEvents\DomainObjects\LiveTrackDomainObject;
use HiEvents\Resources\BaseResource;
use Illuminate\Http\Request;

/**
 * What the participant sees of their own shared track on their ticket.
 *
 * @mixin LiveTrackDomainObject
 */
class LiveTrackResourcePublic extends BaseResource
{
    public function toArray(Request $request): array
    {
        return [
            'status' => $this->getStatus(),
            'last_error' => $this->getLastError(),
            'last_point_at' => $this->getLastPointAt(),
            'distance_m' => $this->getDistanceM(),
            'duration_s' => $this->getDurationS(),
            'shared_at' => $this->getConsentedAt(),
        ];
    }
}
