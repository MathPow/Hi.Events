<?php

namespace HiEvents\Services\Application\Handlers\Organizer;

use HiEvents\DomainObjects\Status\OrganizerStatus;
use HiEvents\Jobs\Organizer\SendOrganizerMessagePushJob;
use HiEvents\Mail\Organizer\OrganizerContactEmail;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerMessageRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Application\Handlers\Organizer\DTO\SendOrganizerContactMessageDTO;
use HiEvents\Services\Infrastructure\HtmlPurifier\HtmlPurifierService;
use Illuminate\Mail\Mailer;
use Psr\Log\LoggerInterface;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Throwable;

class SendOrganizerContactMessageHandler
{
    public function __construct(
        private readonly Mailer                              $mailer,
        private readonly OrganizerRepositoryInterface        $organizerRepository,
        private readonly HtmlPurifierService                 $purifier,
        private readonly OrganizerMessageRepositoryInterface $messageRepository,
        private readonly EventRepositoryInterface            $eventRepository,
        private readonly LoggerInterface                     $logger,
    )
    {
    }

    public function handle(SendOrganizerContactMessageDTO $dto): void
    {
        $organizer = $this->organizerRepository->findById($dto->organizer_id);

        // Don't allow people to contact organizers that are not live, except for the organizer's own account
        if ($organizer->getStatus() !== OrganizerStatus::LIVE->value && $dto->account_id !== $organizer->getAccountId()) {
            throw new ResourceNotFoundException(__('Organizer not found'));
        }

        // Ecrit depuis la page d'un evenement: le message le rappelle, si l'evenement est bien a
        // cet organisateur.
        $eventId = null;
        if ($dto->event_id !== null) {
            $event = $this->eventRepository->findFirstWhere([
                'id' => $dto->event_id,
                'organizer_id' => $organizer->getId(),
            ]);
            $eventId = $event?->getId();
        }

        // Dans la boite de reception du tableau de bord, en texte brut (la page l'echappe).
        $message = $this->messageRepository->create([
            'organizer_id' => $organizer->getId(),
            'event_id' => $eventId,
            'sender_name' => $dto->name,
            'sender_email' => $dto->email,
            'message' => $dto->message,
        ]);

        // Le message est garde: un courriel qui echoue ne fait plus echouer l'envoi du visiteur.
        try {
            $this->mailer
                ->to($organizer->getEmail(), $organizer->getName())
                ->send(new OrganizerContactEmail(
                    organizer: $organizer,
                    senderName: $dto->name,
                    senderEmail: $dto->email,
                    messageContent: $this->purifier->purify($dto->message),
                ));
        } catch (Throwable $exception) {
            $this->logger->error('Organizer contact email failed', [
                'organizer_id' => $organizer->getId(),
                'organizer_message_id' => $message->getId(),
                'error' => $exception->getMessage(),
            ]);
        }

        SendOrganizerMessagePushJob::dispatch($message->getId());
    }
}
