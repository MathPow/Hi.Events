<?php

namespace HiEvents\Services\Application\Handlers\EventChange;

use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\Generated\EventDateChangeDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\Exceptions\EventChangeNotAllowedException;
use HiEvents\Jobs\Event\Webhook\DispatchEventWebhookJob;
use HiEvents\Jobs\EventChange\SendEventPostponedEmailsJob;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\PostponeEventDTO;
use HiEvents\Services\Domain\EventChange\EventChangeRecipientService;
use HiEvents\Services\Domain\EventChange\EventPostponementService;
use HiEvents\Services\Infrastructure\DomainEvents\Enums\DomainEventType;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Database\DatabaseManager;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Throwable;

class PostponeEventHandler
{
    public function __construct(
        private readonly EventRepositoryInterface           $eventRepository,
        private readonly EventDateChangeRepositoryInterface $eventDateChangeRepository,
        private readonly EventPostponementService           $postponementService,
        private readonly EventChangeRecipientService        $recipientService,
        private readonly DatabaseManager                    $databaseManager,
        private readonly Dispatcher                         $dispatcher,
    )
    {
    }

    /**
     * @throws EventChangeNotAllowedException
     * @throws Throwable
     */
    public function handle(PostponeEventDTO $dto): EventDateChangeDomainObject
    {
        $dateChange = $this->databaseManager->transaction(function () use ($dto) {
            // The lock of order creation: no order slips in while the dates move.
            $this->databaseManager->statement('SELECT pg_advisory_xact_lock(?)', [$dto->eventId]);

            $event = $this->eventRepository->findFirstWhere([
                EventDomainObjectAbstract::ID => $dto->eventId,
                EventDomainObjectAbstract::ACCOUNT_ID => $dto->accountId,
            ]);

            if ($event === null) {
                throw new ResourceNotFoundException(__('Event :id not found', ['id' => $dto->eventId]));
            }

            $dateChange = $this->postponementService->postpone($event, $dto);

            return $this->eventDateChangeRepository->updateFromArray($dateChange->getId(), [
                EventDateChangeDomainObjectAbstract::RECIPIENTS_COUNT => $this->recipientService->forEvent($event->getId())->count(),
            ]);
        });

        $this->dispatcher->dispatch(new SendEventPostponedEmailsJob($dateChange->getId()));
        $this->dispatcher->dispatch(new DispatchEventWebhookJob($dto->eventId, DomainEventType::EVENT_UPDATED));

        return $dateChange;
    }
}
