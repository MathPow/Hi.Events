<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A version of an event's waiver as participants signed it. Without
 * SoftDeletes: a signed text is kept as long as the signatures that point to it.
 */
class Waiver extends BaseModel
{
    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }
}
