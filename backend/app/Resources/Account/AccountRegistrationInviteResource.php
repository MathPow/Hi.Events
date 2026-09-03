<?php

declare(strict_types=1);

namespace HiEvents\Resources\Account;

use HiEvents\DomainObjects\AccountRegistrationInviteDomainObject;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * @mixin AccountRegistrationInviteDomainObject
 */
class AccountRegistrationInviteResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->getId(),
            'email' => $this->getEmail(),
            'label' => $this->getLabel(),
            'expires_at' => $this->getExpiresAt(),
            'used_at' => $this->getUsedAt(),
            'revoked_at' => $this->getRevokedAt(),
            'used_by_account_id' => $this->getUsedByAccountId(),
            'created_at' => $this->getCreatedAt(),
            'status' => $this->getStatus(),
        ];
    }

    private function getStatus(): string
    {
        if ($this->getUsedAt() !== null) {
            return 'USED';
        }

        if ($this->getRevokedAt() !== null) {
            return 'REVOKED';
        }

        if ($this->getExpiresAt() !== null && Carbon::parse($this->getExpiresAt())->isPast()) {
            return 'EXPIRED';
        }

        return 'PENDING';
    }
}
