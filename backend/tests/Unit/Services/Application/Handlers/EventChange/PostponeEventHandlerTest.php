<?php

namespace Tests\Unit\Services\Application\Handlers\EventChange;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\Jobs\Event\Webhook\DispatchEventWebhookJob;
use HiEvents\Jobs\EventChange\SendEventPostponedEmailsJob;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\PostponeEventDTO;
use HiEvents\Services\Application\Handlers\EventChange\PostponeEventHandler;
use HiEvents\Services\Domain\EventChange\DTO\EventChangeRecipientsDTO;
use HiEvents\Services\Domain\EventChange\EventChangeRecipientService;
use HiEvents\Services\Domain\EventChange\EventPostponementService;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Database\DatabaseManager;
use Mockery;
use Tests\TestCase;

class PostponeEventHandlerTest extends TestCase
{
    public function test_it_records_how_many_people_are_told_then_queues_the_emails(): void
    {
        $steps = [];

        $databaseManager = Mockery::mock(DatabaseManager::class);
        $databaseManager->shouldReceive('transaction')->andReturnUsing(function (callable $callback) use (&$steps) {
            $result = $callback();
            $steps[] = 'commit';
            return $result;
        });
        $databaseManager->shouldReceive('statement')->once()->with('SELECT pg_advisory_xact_lock(?)', [5])->andReturnTrue();

        $event = (new EventDomainObject())->setId(5);
        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('findFirstWhere')->with(['id' => 5, 'account_id' => 1])->andReturn($event);

        $dto = new PostponeEventDTO(
            eventId: 5,
            accountId: 1,
            userId: 9,
            startDate: '2026-11-21 09:00',
            endDate: null,
            message: 'Reporté.',
            refundsAllowed: true,
            refundDeadline: null,
        );

        $postponementService = Mockery::mock(EventPostponementService::class);
        $postponementService->shouldReceive('postpone')->once()->with($event, $dto)->andReturn((new EventDateChangeDomainObject())->setId(7));

        $recipientService = Mockery::mock(EventChangeRecipientService::class);
        $recipientService->shouldReceive('forEvent')->with(5)->andReturn(new EventChangeRecipientsDTO(
            orders: collect([new OrderDomainObject(), new OrderDomainObject()]),
            attendees: collect([new AttendeeDomainObject()]),
        ));

        $dateChangeRepository = Mockery::mock(EventDateChangeRepositoryInterface::class);
        $dateChangeRepository->shouldReceive('updateFromArray')->once()->with(7, ['recipients_count' => 3])
            ->andReturn((new EventDateChangeDomainObject())->setId(7)->setRecipientsCount(3));

        $jobs = [];
        $dispatcher = Mockery::mock(Dispatcher::class);
        $dispatcher->shouldReceive('dispatch')->andReturnUsing(function ($job) use (&$jobs, &$steps) {
            $jobs[] = $job;
            $steps[] = 'dispatch';
            return null;
        });

        $dateChange = (new PostponeEventHandler(
            $eventRepository,
            $dateChangeRepository,
            $postponementService,
            $recipientService,
            $databaseManager,
            $dispatcher,
        ))->handle($dto);

        $this->assertSame(3, $dateChange->getRecipientsCount());
        $this->assertSame(['commit', 'dispatch', 'dispatch'], $steps);
        $this->assertInstanceOf(SendEventPostponedEmailsJob::class, $jobs[0]);
        $this->assertSame(7, $jobs[0]->eventDateChangeId);
        $this->assertInstanceOf(DispatchEventWebhookJob::class, $jobs[1]);
    }
}
