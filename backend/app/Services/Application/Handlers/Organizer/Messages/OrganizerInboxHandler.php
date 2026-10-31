<?php

namespace HiEvents\Services\Application\Handlers\Organizer\Messages;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrganizerMessageDomainObject;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\OrganizerMessageRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;

/**
 * La boite de reception d'un organisateur: les messages du bouton « Contacter », lus ou non.
 */
class OrganizerInboxHandler
{
    public function __construct(
        private readonly OrganizerMessageRepositoryInterface $messageRepository,
    )
    {
    }

    public function list(int $organizerId, int $page, int $perPage, bool $unreadOnly): LengthAwarePaginator
    {
        return $this->messageRepository
            ->loadRelation(new Relationship(EventDomainObject::class, name: 'event'))
            ->paginateForOrganizer($organizerId, min(max($perPage, 1), 100), max($page, 1), $unreadOnly);
    }

    public function unreadCount(int $organizerId): int
    {
        return $this->messageRepository->countWhere([
            'organizer_id' => $organizerId,
            ['read_at', 'null', null],
        ]);
    }

    public function setRead(int $organizerId, int $messageId, bool $read): OrganizerMessageDomainObject
    {
        $message = $this->find($organizerId, $messageId);

        $this->messageRepository->updateFromArray($message->getId(), [
            'read_at' => $read ? ($message->getReadAt() ?? Carbon::now()) : null,
        ]);

        return $this->messageRepository
            ->loadRelation(new Relationship(EventDomainObject::class, name: 'event'))
            ->findById($message->getId());
    }

    public function markAllRead(int $organizerId): int
    {
        return $this->messageRepository->updateWhere(
            ['read_at' => Carbon::now()],
            ['organizer_id' => $organizerId, ['read_at', 'null', null]],
        );
    }

    public function delete(int $organizerId, int $messageId): void
    {
        $message = $this->find($organizerId, $messageId);

        $this->messageRepository->deleteById($message->getId());
    }

    private function find(int $organizerId, int $messageId): OrganizerMessageDomainObject
    {
        $message = $this->messageRepository->findFirstWhere([
            'id' => $messageId,
            'organizer_id' => $organizerId,
        ]);

        if ($message === null) {
            throw new ResourceNotFoundException(__('Message not found'));
        }

        return $message;
    }
}
