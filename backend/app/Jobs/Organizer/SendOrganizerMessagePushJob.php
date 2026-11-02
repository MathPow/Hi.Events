<?php

namespace HiEvents\Jobs\Organizer;

use HiEvents\DomainObjects\OrganizerMessageDomainObject;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Repository\Interfaces\OrganizerMessageRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Domain\Notification\WebPushService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\DatabaseManager;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Str;

/**
 * Un nouveau message « Contacter »: une notification sur les appareils abonnes de chaque membre
 * actif du compte de l'organisateur. Hors de la requete, pour ne pas faire attendre le visiteur.
 */
class SendOrganizerMessagePushJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 2;

    public function __construct(
        private readonly int $messageId,
    )
    {
    }

    public function handle(
        OrganizerMessageRepositoryInterface $messageRepository,
        OrganizerRepositoryInterface        $organizerRepository,
        UserRepositoryInterface             $userRepository,
        WebPushService                      $webPushService,
        DatabaseManager                     $db,
    ): void
    {
        /** @var OrganizerMessageDomainObject|null $message */
        $message = $messageRepository->findFirstWhere(['id' => $this->messageId]);
        if ($message === null || $message->getReadAt() !== null) {
            return;
        }

        $organizer = $organizerRepository->findFirstWhere(['id' => $message->getOrganizerId()]);
        if ($organizer === null) {
            return;
        }

        $userIds = $db->table('account_users')
            ->where('account_id', $organizer->getAccountId())
            ->whereNull('deleted_at')
            ->where('status', 'ACTIVE')
            ->pluck('user_id')
            ->unique()
            ->all();

        if ($userIds === []) {
            return;
        }

        /** @var UserDomainObject $user */
        foreach ($userRepository->findWhereIn('id', $userIds) as $user) {
            $locale = $user->getLocale() ?: 'fr';
            $separator = str_starts_with($locale, 'fr') ? ' : ' : ': ';

            $webPushService->sendToUser($user->getId(), [
                'title' => __('New message · :organizer', ['organizer' => $organizer->getName()], $locale),
                'body' => $message->getSenderName() . $separator . Str::limit(Str::squish($message->getMessage()), 140),
                // Opens the message with its answer ready to write.
                'url' => '/manage/organizer/' . $organizer->getId() . '/messages?message=' . $message->getId() . '&reply=1',
                'tag' => 'organizer-message-' . $message->getId(),
            ]);
        }
    }
}
