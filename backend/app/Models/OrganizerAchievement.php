<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An achievement an organizer has earned. Without SoftDeletes: once earned, it stays.
 */
class OrganizerAchievement extends BaseModel
{
    public function organizer(): BelongsTo
    {
        return $this->belongsTo(Organizer::class);
    }
}
