<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A participant's shared Garmin LiveTrack session for an event, with their last known position.
 */
class LiveTrack extends BaseModel
{
    protected function getCastMap(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'altitude_m' => 'float',
            'speed_mps' => 'float',
            'distance_m' => 'float',
            'elevation_gain_m' => 'float',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function attendee(): BelongsTo
    {
        return $this->belongsTo(Attendee::class);
    }

    public function live_track_points(): HasMany
    {
        return $this->hasMany(LiveTrackPoint::class);
    }
}
