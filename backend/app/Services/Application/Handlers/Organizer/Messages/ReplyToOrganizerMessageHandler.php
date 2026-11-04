<?php

namespace HiEvents\Services\Application\Handlers\Organizer\Messages;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrganizerMessageDomainObject;
use HiEvents\Exceptions\AccountNotVerifiedException;
use HiEvents\Mail\Organizer\OrganizerContactReplyEmail;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerMessageReplyRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerMessageRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Application\Handlers\Organizer\Messages\DTO\ReplyToOrganizerMessageDTO;
use Illuminate\Mail\Mailer;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

/**
 * Repondre depuis la boite de reception: le courriel part a la personne qui a ecrit (et a elle
 * seule), en reponse a l'adresse de l'organisateur, et le message est marque repondu et lu.
 */
class ReplyToOrganizerMessageHandler
{
    public function __construct(
        private readonly OrganizerMessageRepositoryInterface      $messageRepository,
        private readonly OrganizerMessageReplyRepositoryInterface $replyRepository,
        private readonly OrganizerRepositoryInterface        $organizerRepository,
        private readonly AccountRepositoryInterface          $accountRepository,
        private readonly Mailer                              $mailer,
    )
    {
    }

    /**
     * @throws AccountNotVerifiedException
     */
    public function handle(ReplyToOrganizerMessageDTO $dto): OrganizerMessageDomainObject
    {
        $message = $this->messageRepository->findFirstWhere([
            'id' => $dto->message_id,
            'organizer_id' => $dto->organizer_id,
        ]);

        if ($message === null) {
            throw new ResourceNotFoundException(__('Message not found'));
        }

        $organizer = $this->organizerRepository->findById($dto->organizer_id);
        $account = $this->accountRepository->findById($organizer->getAccountId());

        if ($account->getAccountVerifiedAt() === null) {
            throw new AccountNotVerifiedException(__('You cannot send messages until your account is verified.'));
        }

        $this->mailer
            ->to($message->getSenderEmail(), $message->getSenderName())
            ->locale($dto->locale ?: config('app.locale'))
            ->send(new OrganizerContactReplyEmail(
                organizer: $organizer,
                message: $message,
                reply: trim($dto->reply),
            ));

        $this->replyRepository->create([
            'organizer_message_id' => $message->getId(),
            'user_id' => $dto->user_id,
            'message' => trim($dto->reply),
        ]);

        // As text: the repository hands the saved values straight to the domain object's setters.
        $now = Carbon::now()->toDateTimeString();
        $this->messageRepository->updateFromArray($message->getId(), [
            'replied_at' => $now,
            'read_at' => $message->getReadAt() ?? $now,
        ]);

        return $this->messageRepository
            ->loadRelation(new Relationship(EventDomainObject::class, name: 'event'))
            ->loadRelation(OrganizerInboxHandler::repliesRelation())
            ->findById($message->getId());
    }
}
