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
 * The team members who asked for a copy by email (the « ⋮ » of « Membres de l'équipe »), on top
 * of the organizer's contact email: of the visitors' messages, of each new order.
 */
class TeamEmailRecipientService
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
    public function visitorMessageCopies(OrganizerDomainObject $organizer): Collection
    {
        return $this->copies($organizer, AccountUserDomainObjectAbstract::RECEIVES_ORGANIZER_MESSAGES);
    }

    /**
     * @return Collection<int, UserDomainObject>
     */
    public function newOrderCopies(OrganizerDomainObject $organizer): Collection
    {
        return $this->copies($organizer, AccountUserDomainObjectAbstract::RECEIVES_ORDER_NOTIFICATIONS);
    }

    /**
     * @return Collection<int, UserDomainObject>
     */
    private function copies(OrganizerDomainObject $organizer, string $setting): Collection
    {
        $userIds = $this->accountUserRepository->findWhere([
            AccountUserDomainObjectAbstract::ACCOUNT_ID => $organizer->getAccountId(),
            AccountUserDomainObjectAbstract::STATUS => UserStatus::ACTIVE->name,
            $setting => true,
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
