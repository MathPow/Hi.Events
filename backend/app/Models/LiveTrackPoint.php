<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiveTrackPoint extends BaseModel
{
    protected function getTimestampsEnabled(): bool
    {
        return false;
    }

    protected function getCastMap(): array
    {
        return [
            'latitude' => 'float',
            'longitude' => 'float',
            'altitude_m' => 'float',
            'speed_mps' => 'float',
            'distance_m' => 'float',
        ];
    }

    public function live_track(): BelongsTo
    {
        return $this->belongsTo(LiveTrack::class);
    }
}
