<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Un message recu par le bouton « Contacter » (page de l'organisateur ou d'un evenement).
 */
class OrganizerMessage extends BaseModel
{
    use SoftDeletes;

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(Organizer::class);
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function replies(): HasMany
    {
        return $this->hasMany(OrganizerMessageReply::class);
    }
}
