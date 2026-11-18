<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The cancellation of an event: what participants were told and whether paid orders are refunded.
 */
class EventCancellation extends BaseModel
{
    protected function getCastMap(): array
    {
        return [
            'refund_orders' => 'boolean',
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

    public function event_change_refunds(): HasMany
    {
        return $this->hasMany(EventChangeRefund::class);
    }
}
