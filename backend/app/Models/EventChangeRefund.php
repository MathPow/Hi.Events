<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * What happened to an order after its event was postponed (the participant asked for a refund)
 * or cancelled: refunded, cancelled without payment, left to the organizer, or failed.
 */
class EventChangeRefund extends BaseModel
{
    protected function getCastMap(): array
    {
        return [
            'amount' => 'float',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function event_date_change(): BelongsTo
    {
        return $this->belongsTo(EventDateChange::class);
    }

    public function event_cancellation(): BelongsTo
    {
        return $this->belongsTo(EventCancellation::class);
    }
}
