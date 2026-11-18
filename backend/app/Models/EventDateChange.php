<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A postponement of an event: its old and new dates, and what participants were told.
 */
class EventDateChange extends BaseModel
{
    protected function getCastMap(): array
    {
        return [
            'refunds_allowed' => 'boolean',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
