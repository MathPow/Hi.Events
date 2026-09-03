<?php

namespace HiEvents\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AccountRegistrationInvite extends BaseModel
{
    use SoftDeletes;

    protected function getCastMap(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function createdByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function usedByAccount(): BelongsTo
    {
        return $this->belongsTo(Account::class, 'used_by_account_id');
    }
}
