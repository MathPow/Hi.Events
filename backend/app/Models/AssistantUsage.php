<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One call of the organizers' assistant to Anthropic: its tokens and its cost.
 */
class AssistantUsage extends BaseModel
{
    protected function getCastMap(): array
    {
        return [
            'cost_usd' => 'float',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
