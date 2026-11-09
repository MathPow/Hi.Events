<?php

namespace HiEvents\Services\Application\Handlers\Event;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Exceptions\AccountNotVerifiedException;
use HiEvents\Exceptions\EventNotReadyToPublishException;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\DTO\UpdateEventStatusDTO;
use HiEvents\Services\Domain\Event\EventPublishReadinessService;
use HiEvents\DomainObjects\Status\EventStatus;
use HiEvents\Jobs\Event\Webhook\DispatchEventWebhookJob;
use HiEvents\Services\Infrastructure\DomainEvents\Enums\DomainEventType;
use Illuminate\Database\DatabaseManager;
use Psr\Log\LoggerInterface;
use Throwable;

readonly class UpdateEventStatusHandler
{
    public function __construct(
        private EventRepositoryInterface   $eventRepository,
        private AccountRepositoryInterface $accountRepository,
        private LoggerInterface            $logger,
        private DatabaseManager            $databaseManager,
        private EventPublishReadinessService $publishReadinessService,
    )
    {
    }

    /**
     * @throws AccountNotVerifiedException|Throwable
     */
    public function handle(UpdateEventStatusDTO $updateEventStatusDTO): EventDomainObject
    {
        return $this->databaseManager->transaction(function () use ($updateEventStatusDTO) {
            return $this->updateEventStatus($updateEventStatusDTO);
        });

    }

    /**
     * @throws AccountNotVerifiedException|EventNotReadyToPublishException
     */
    private function updateEventStatus(UpdateEventStatusDTO $updateEventStatusDTO): EventDomainObject
    {
        $account = $this->accountRepository->findById($updateEventStatusDTO->accountId);

        if ($account->getAccountVerifiedAt() === null) {
            throw new AccountNotVerifiedException(
                __('Please confirm your email address before changing an event\'s status. Open your profile page and click "Resend email confirmation" to receive the link again.'),
            );
        }

        if ($updateEventStatusDTO->status === EventStatus::LIVE->name) {
            $currentEvent = $this->eventRepository->findFirstWhere([
                'id' => $updateEventStatusDTO->eventId,
                'account_id' => $updateEventStatusDTO->accountId,
            ]);

            if ($currentEvent !== null && $currentEvent->getStatus() !== EventStatus::LIVE->name) {
                $this->publishReadinessService->assertCanPublish($currentEvent);
            }
        }

        $this->eventRepository->updateWhere(
            attributes: ['status' => $updateEventStatusDTO->status],
            where: [
                'id' => $updateEventStatusDTO->eventId,
                'account_id' => $updateEventStatusDTO->accountId,
            ]
        );

        $this->logger->info('Event status updated', [
            'eventId' => $updateEventStatusDTO->eventId,
            'status' => $updateEventStatusDTO->status
        ]);

        $event = $this->eventRepository->findFirstWhere([
            'id' => $updateEventStatusDTO->eventId,
            'account_id' => $updateEventStatusDTO->accountId,
        ]);

        $eventType = $updateEventStatusDTO->status === EventStatus::ARCHIVED->name
            ? DomainEventType::EVENT_ARCHIVED
            : DomainEventType::EVENT_UPDATED;

        DispatchEventWebhookJob::dispatch(
            $event->getId(),
            $eventType,
        );

        return $event;
    }
}
