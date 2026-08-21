<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Volontairement SANS SoftDeletes: un recu officiel emis se conserve, il ne
 * s'efface pas. Cf. la migration create_donation_receipts_table.
 */
class DonationReceipt extends BaseModel
{
    protected function getCastMap(): array
    {
        return [
            'total_received' => 'float',
            'advantage_amount' => 'float',
            'eligible_amount' => 'float',
            'receipt_year' => 'integer',
            'issue_date' => 'date',
            'donation_date' => 'date',
        ];
    }

    protected function getFillableFields(): array
    {
        return [];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function organizer(): BelongsTo
    {
        return $this->belongsTo(Organizer::class);
    }
}
