<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An attendee's copy of an organizer's document, as it read at checkout:
 * signed online, or filled with their details to print.
 */
class DocumentSignature extends BaseModel
{
    protected function getCastMap(): array
    {
        return [
            'blocks' => 'array',
            'answers' => 'array',
            'auto_values' => 'array',
        ];
    }

    public function attendee(): BelongsTo
    {
        return $this->belongsTo(Attendee::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
