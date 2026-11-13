<?php

namespace HiEvents\Services\Application\Handlers\EventChange;

use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\Generated\EventDomainObjectAbstract;
use HiEvents\Exceptions\EventChangeNotAllowedException;
use HiEvents\Jobs\Event\Webhook\DispatchEventWebhookJob;
use HiEvents\Jobs\EventChange\StartEventCancellationJob;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\CancelEventDTO;
use HiEvents\Services\Domain\EventChange\EventCancellationService;
use HiEvents\Services\Domain\EventChange\EventChangeRecipientService;
use HiEvents\Services\Infrastructure\DomainEvents\Enums\DomainEventType;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Database\DatabaseManager;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Throwable;

class CancelEventHandler
{
    public function __construct(
        private readonly EventRepositoryInterface    $eventRepository,
        private readonly EventCancellationService    $cancellationService,
        private readonly EventChangeRecipientService $recipientService,
        private readonly DatabaseManager             $databaseManager,
        private readonly Dispatcher                  $dispatcher,
    )
    {
    }

    /**
     * @throws EventChangeNotAllowedException
     * @throws Throwable
     */
    public function handle(CancelEventDTO $dto): EventCancellationDomainObject
    {
        $cancellation = $this->databaseManager->transaction(function () use ($dto) {
            // The lock of order creation: once cancelled, no order can start.
            $this->databaseManager->statement('SELECT pg_advisory_xact_lock(?)', [$dto->eventId]);

            $event = $this->eventRepository->findFirstWhere([
                EventDomainObjectAbstract::ID => $dto->eventId,
                EventDomainObjectAbstract::ACCOUNT_ID => $dto->accountId,
            ]);

            if ($event === null) {
                throw new ResourceNotFoundException(__('Event :id not found', ['id' => $dto->eventId]));
            }

            return $this->cancellationService->cancel($event, $dto, $this->recipientService->forEvent($event->getId()));
        });

        $this->dispatcher->dispatch(new StartEventCancellationJob($cancellation->getId()));
        $this->dispatcher->dispatch(new DispatchEventWebhookJob($dto->eventId, DomainEventType::EVENT_UPDATED));

        return $cancellation;
    }
}
