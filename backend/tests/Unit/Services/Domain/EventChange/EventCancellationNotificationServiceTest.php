<?php

namespace Tests\Unit\Services\Domain\EventChange;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventChangeRefundDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Jobs\EventChange\CancelEventOrderJob;
use HiEvents\Mail\EventChange\EventCancelledMail;
use HiEvents\Repository\Interfaces\EventCancellationRepositoryInterface;
use HiEvents\Repository\Interfaces\EventChangeRefundRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Domain\EventChange\DTO\EventChangeRecipientsDTO;
use HiEvents\Services\Domain\EventChange\EventCancellationNotificationService;
use HiEvents\Services\Domain\EventChange\EventChangeRecipientService;
use Illuminate\Contracts\Bus\Dispatcher;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Mail\PendingMail;
use Mockery;
use Tests\TestCase;

class EventCancellationNotificationServiceTest extends TestCase
{
    public function test_other_participants_are_told_and_each_order_gets_its_own_job(): void
    {
        $cancellationRepository = Mockery::mock(EventCancellationRepositoryInterface::class);
        $cancellationRepository->shouldReceive('findById')->with(4)->andReturn(
            (new EventCancellationDomainObject())->setId(4)->setEventId(5)->setMessage('Annulé.')->setRefundOrders(true),
        );

        $eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $eventRepository->shouldReceive('loadRelation')->andReturnSelf();
        $eventRepository->shouldReceive('findById')->with(5)->andReturn(
            (new EventDomainObject())
                ->setId(5)
                ->setOrganizer(new OrganizerDomainObject())
                ->setEventSettings(new EventSettingDomainObject()),
        );

        $recipientService = Mockery::mock(EventChangeRecipientService::class);
        $recipientService->shouldReceive('forEvent')->with(5)->andReturn(new EventChangeRecipientsDTO(
            orders: collect([(new OrderDomainObject())->setId(1), (new OrderDomainObject())->setId(2)]),
            attendees: collect([(new AttendeeDomainObject())->setEmail('sam@example.com')->setFirstName('Sam')->setLastName('L')]),
        ));

        $refundRepository = Mockery::mock(EventChangeRefundRepositoryInterface::class);
        $refundRepository->shouldReceive('findWhere')
            ->with(['event_cancellation_id' => 4, 'status' => EventChangeRefundStatus::PENDING->name])
            ->andReturn(collect([
                (new EventChangeRefundDomainObject())->setId(11),
                (new EventChangeRefundDomainObject())->setId(12),
            ]));

        $sent = [];
        $pending = Mockery::mock(PendingMail::class);
        $pending->shouldReceive('locale')->andReturnSelf();
        $pending->shouldReceive('send')->andReturnUsing(function ($mail) use (&$sent) {
            $sent[] = $mail;
            return null;
        });
        $mailer = Mockery::mock(Mailer::class);
        $mailer->shouldReceive('to')->once()->with('sam@example.com', 'Sam L')->andReturn($pending);

        $jobs = [];
        $dispatcher = Mockery::mock(Dispatcher::class);
        $dispatcher->shouldReceive('dispatch')->andReturnUsing(function ($job) use (&$jobs) {
            $jobs[] = $job;
            return null;
        });

        (new EventCancellationNotificationService(
            $cancellationRepository,
            $refundRepository,
            $eventRepository,
            $recipientService,
            $mailer,
            $dispatcher,
        ))->start(4);

        $this->assertCount(1, $sent);
        $this->assertInstanceOf(EventCancelledMail::class, $sent[0]);
        $this->assertNull($sent[0]->refundStatus);
        $this->assertContainsOnlyInstancesOf(CancelEventOrderJob::class, $jobs);
        $this->assertSame([11, 12], array_map(fn(CancelEventOrderJob $job) => $job->eventChangeRefundId, $jobs));
    }
}
