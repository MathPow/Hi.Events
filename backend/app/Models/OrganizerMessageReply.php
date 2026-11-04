<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Une reponse de l'organisateur a un message de sa boite de reception, envoyee par courriel.
 */
class OrganizerMessageReply extends BaseModel
{
    use SoftDeletes;

    public function organizerMessage(): BelongsTo
    {
        return $this->belongsTo(OrganizerMessage::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
