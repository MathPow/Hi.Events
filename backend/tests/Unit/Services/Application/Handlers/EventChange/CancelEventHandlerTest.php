<?php

namespace Tests\Unit\Services\Application\Handlers\EventChange;

use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Jobs\Event\Webhook\DispatchEventWebhookJob;
use HiEvents\Jobs\EventChange\StartEventCancellationJob;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\CancelEventHandler;
use HiEvents\Services\Application\Handlers\EventChange\DTO\CancelEventDTO;
use HiEvents\Services\Domain\EventChange\DTO\EventChangeRecipientsDTO;
use HiEvents\Services\Domain\EventChange\EventCancellationService;
use HiEvents\Services\Domain\EventChange\EventChangeRecipientService;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Database\DatabaseManager;
use Mockery;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Tests\TestCase;

class CancelEventHandlerTest extends TestCase
{
    public function test_it_cancels_under_the_order_creation_lock_then_starts_the_jobs(): void
    {
        $steps = [];

        $databaseManager = Mockery::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(function (callable $callback) use (&$steps) {
            $result = $callback();
            $steps[] = 'commit';
            return $result;
        });
        $databaseManager->shouldReceive('statement')->once()->with('SELECT pg_advisory_xact_lock(?)', [5])
            ->andReturnUsing(function () use (&$steps) {
                $steps[] = 'lock';
                return true;
            });

        $event = (new EventDomainObject())->setId(5);
        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('findFirstWhere')->with(['id' => 5, 'account_id' => 1])->andReturn($event);

        $recipients = new EventChangeRecipientsDTO(orders: collect(), attendees: collect());
        $recipientService = Mockery::mock(EventChangeRecipientService::class);
        $recipientService->shouldReceive('forEvent')->with(5)->andReturn($recipients);

        $cancellationService = Mockery::mock(EventCancellationService::class);
        $cancellationService->shouldReceive('cancel')->once()->with($event, Mockery::type(CancelEventDTO::class), $recipients)
            ->andReturnUsing(function () use (&$steps) {
                $steps[] = 'cancel';
                return (new EventCancellationDomainObject())->setId(4);
            });

        $dispatched = [];
        $dispatcher = Mockery::mock(Dispatcher::class);
        $dispatcher->shouldReceive('dispatch')->andReturnUsing(function ($job) use (&$dispatched, &$steps) {
            $dispatched[] = $job;
            $steps[] = 'dispatch';
            return null;
        });

        $handler = new CancelEventHandler($eventRepository, $cancellationService, $recipientService, $databaseManager, $dispatcher);
        $handler->handle(new CancelEventDTO(eventId: 5, accountId: 1, userId: 9, message: 'Annulé.', refundOrders: true));

        $this->assertSame(['lock', 'cancel', 'commit', 'dispatch', 'dispatch'], $steps);
        $this->assertInstanceOf(StartEventCancellationJob::class, $dispatched[0]);
        $this->assertSame(4, $dispatched[0]->eventCancellationId);
        $this->assertInstanceOf(DispatchEventWebhookJob::class, $dispatched[1]);
    }

    public function test_an_event_of_another_account_is_not_found(): void
    {
        $databaseManager = Mockery::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(fn(callable $callback) => $callback());
        $databaseManager->shouldReceive('statement')->andReturnTrue();

        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('findFirstWhere')->andReturnNull();

        $dispatcher = Mockery::mock(Dispatcher::class);
        $dispatcher->shouldNotReceive('dispatch');

        $handler = new CancelEventHandler(
            $eventRepository,
            Mockery::mock(EventCancellationService::class),
            Mockery::mock(EventChangeRecipientService::class),
            $databaseManager,
            $dispatcher,
        );

        $this->expectException(ResourceNotFoundException::class);

        $handler->handle(new CancelEventDTO(eventId: 5, accountId: 2, userId: 9, message: 'Annulé.', refundOrders: true));
    }
}
