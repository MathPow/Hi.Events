<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Account;

use HiEvents\DomainObjects\AccountRegistrationInviteDomainObject;
use HiEvents\Exceptions\InvalidRegistrationInviteException;
use HiEvents\Helper\Url;
use HiEvents\Repository\Interfaces\AccountRegistrationInviteRepositoryInterface;
use HiEvents\Services\Domain\Account\DTO\CreatedRegistrationInviteDTO;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Invitations a creer un compte, quand l'inscription publique est fermee.
 *
 * Le jeton n'est stocke que hashe, et il ne vaut qu'une fois: la consommation
 * passe par un UPDATE conditionnel, donc deux inscriptions simultanees avec le
 * meme lien ne peuvent pas creer deux comptes.
 */
class AccountRegistrationInviteService
{
    private const TOKEN_LENGTH = 48;

    public function __construct(
        private readonly AccountRegistrationInviteRepositoryInterface $inviteRepository,
    )
    {
    }

    public function create(
        ?string $email,
        ?string $label,
        ?int    $expiresInDays,
        int     $createdByUserId,
    ): CreatedRegistrationInviteDTO
    {
        $token = Str::random(self::TOKEN_LENGTH);

        $invite = $this->inviteRepository->create([
            'token_hash' => $this->hashToken($token),
            'email' => $email === null ? null : strtolower(trim($email)),
            'label' => $label,
            'expires_at' => $expiresInDays === null
                ? null
                : Carbon::now()->addDays($expiresInDays)->toDateTimeString(),
            'created_by_user_id' => $createdByUserId,
        ]);

        return new CreatedRegistrationInviteDTO(
            invite: $invite,
            registrationUrl: sprintf(Url::getFrontEndUrlFromConfig(Url::REGISTRATION_INVITE), $token),
        );
    }

    /**
     * @throws InvalidRegistrationInviteException
     */
    public function findUsableByToken(string $token): AccountRegistrationInviteDomainObject
    {
        $invite = $this->inviteRepository->findFirstWhere([
            'token_hash' => $this->hashToken($token),
        ]);

        if ($invite === null) {
            throw new InvalidRegistrationInviteException(
                __('This invitation link is not valid.')
            );
        }

        if ($invite->getUsedAt() !== null) {
            throw new InvalidRegistrationInviteException(
                __('This invitation link has already been used.')
            );
        }

        if ($invite->getRevokedAt() !== null) {
            throw new InvalidRegistrationInviteException(
                __('This invitation link has been revoked.')
            );
        }

        if ($this->isExpired($invite)) {
            throw new InvalidRegistrationInviteException(
                __('This invitation link has expired.')
            );
        }

        return $invite;
    }

    /**
     * @throws InvalidRegistrationInviteException
     */
    public function assertUsableForEmail(AccountRegistrationInviteDomainObject $invite, string $email): void
    {
        if ($invite->getEmail() === null) {
            return;
        }

        if (strtolower(trim($email)) !== strtolower($invite->getEmail())) {
            throw new InvalidRegistrationInviteException(
                __('This invitation link was issued for a different email address.')
            );
        }
    }

    /**
     * @throws InvalidRegistrationInviteException
     */
    public function consume(AccountRegistrationInviteDomainObject $invite, int $accountId): void
    {
        $consumed = $this->inviteRepository->updateWhere(
            attributes: [
                'used_at' => Carbon::now()->toDateTimeString(),
                'used_by_account_id' => $accountId,
            ],
            where: [
                'id' => $invite->getId(),
                // Forme tableau obligatoire: une egalite avec null ne matche
                // jamais en SQL, il faut un IS NULL.
                'used_at' => ['used_at', 'null', null],
            ],
        );

        if ($consumed === 0) {
            throw new InvalidRegistrationInviteException(
                __('This invitation link has already been used.')
            );
        }
    }

    public function revoke(int $inviteId): void
    {
        $this->inviteRepository->updateWhere(
            attributes: [
                'revoked_at' => Carbon::now()->toDateTimeString(),
            ],
            where: [
                'id' => $inviteId,
                'revoked_at' => ['revoked_at', 'null', null],
            ],
        );
    }

    public function isExpired(AccountRegistrationInviteDomainObject $invite): bool
    {
        return $invite->getExpiresAt() !== null
            && Carbon::parse($invite->getExpiresAt())->isPast();
    }

    private function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }
}
