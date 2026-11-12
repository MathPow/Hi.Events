<?php

namespace HiEvents\Services\Domain\Organizer;

use HiEvents\DomainObjects\AccountUserDomainObject;
use HiEvents\DomainObjects\Generated\AccountUserDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\UserStatus;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Repository\Interfaces\AccountUserRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use Illuminate\Support\Collection;

/**
 * The team members who asked for a copy of the visitors' messages by email (the « ⋮ » of
 * « Membres de l'équipe »), on top of the organizer's contact email.
 */
class OrganizerMessageRecipientService
{
    public function __construct(
        private readonly AccountUserRepositoryInterface $accountUserRepository,
        private readonly UserRepositoryInterface        $userRepository,
    )
    {
    }

    /**
     * @return Collection<int, UserDomainObject>
     */
    public function memberCopies(OrganizerDomainObject $organizer): Collection
    {
        $userIds = $this->accountUserRepository->findWhere([
            AccountUserDomainObjectAbstract::ACCOUNT_ID => $organizer->getAccountId(),
            AccountUserDomainObjectAbstract::STATUS => UserStatus::ACTIVE->name,
            AccountUserDomainObjectAbstract::RECEIVES_ORGANIZER_MESSAGES => true,
        ])->map(fn(AccountUserDomainObject $accountUser) => $accountUser->getUserId())->unique()->values();

        if ($userIds->isEmpty()) {
            return collect();
        }

        $contactEmail = $this->normalize($organizer->getEmail());

        return $this->userRepository->findWhereIn('id', $userIds->all())
            ->filter(fn(UserDomainObject $user) => $this->normalize($user->getEmail()) !== ''
                && $this->normalize($user->getEmail()) !== $contactEmail)
            ->unique(fn(UserDomainObject $user) => $this->normalize($user->getEmail()))
            ->values();
    }

    private function normalize(?string $email): string
    {
        return mb_strtolower(trim((string)$email));
    }
}
