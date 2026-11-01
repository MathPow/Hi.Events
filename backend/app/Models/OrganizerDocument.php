<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * An organizer's document (waiver, consent form...), made of blocks and linked to events.
 */
class OrganizerDocument extends BaseModel
{
    use SoftDeletes;

    protected function getCastMap(): array
    {
        return [
            'blocks' => 'array',
        ];
    }

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(Organizer::class);
    }

    public function events(): BelongsToMany
    {
        return $this->belongsToMany(Event::class, 'event_organizer_document')->withTimestamps();
    }
}
