<?php

namespace HiEvents\Resources\LiveTrack;

use HiEvents\DomainObjects\LiveTrackDomainObject;
use HiEvents\Resources\BaseResource;
use Illuminate\Http\Request;

/**
 * A participant on the organizer's live map: who, where, and their watch's figures.
 *
 * @mixin LiveTrackDomainObject
 */
class LiveTrackResource extends BaseResource
{
    public function toArray(Request $request): array
    {
        $attendee = $this->getAttendee();

        return [
            'id' => $this->getId(),
            'attendee_id' => $this->getAttendeeId(),
            'attendee' => $attendee ? [
                'first_name' => $attendee->getFirstName(),
                'last_name' => $attendee->getLastName(),
                'public_id' => $attendee->getPublicId(),
                'bib_number' => $attendee->getBibNumber(),
                'product_id' => $attendee->getProductId(),
                'product_title' => $attendee->getProduct()?->getTitle(),
            ] : null,
            'status' => $this->getStatus(),
            'last_error' => $this->getLastError(),
            'shared_at' => $this->getConsentedAt(),
            'last_polled_at' => $this->getLastPolledAt(),
            'last_point_at' => $this->getLastPointAt(),
            'still_since' => $this->getStillSince(),
            'latitude' => $this->getLatitude(),
            'longitude' => $this->getLongitude(),
            'altitude_m' => $this->getAltitudeM(),
            'speed_mps' => $this->getSpeedMps(),
            'distance_m' => $this->getDistanceM(),
            'duration_s' => $this->getDurationS(),
            'elevation_gain_m' => $this->getElevationGainM(),
            'heart_rate' => $this->getHeartRate(),
            'cadence' => $this->getCadence(),
            'share_url' => $this->getShareUrl(),
        ];
    }
}
