<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un appareil (navigateur ou app installee) qui recoit les notifications Web Push d'un utilisateur.
 */
class PushSubscription extends BaseModel
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
