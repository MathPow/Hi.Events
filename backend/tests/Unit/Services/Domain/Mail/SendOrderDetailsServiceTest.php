<?php

namespace Tests\Unit\Services\Domain\Mail;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Domain\Attendee\SendAttendeeTicketService;
use HiEvents\Services\Domain\Email\MailBuilderService;
use HiEvents\Services\Domain\Mail\SendOrderDetailsService;
use HiEvents\Services\Domain\Organizer\TeamEmailRecipientService;
use HiEvents\DomainObjects\UserDomainObject;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Illuminate\Mail\Mailer;
use Illuminate\Mail\PendingMail;
use Illuminate\Support\Collection;
use Mockery;
use Tests\TestCase;

class SendOrderDetailsServiceTest extends TestCase
{
    private SendAttendeeTicketService $sendAttendeeTicketService;

    private Collection $attendees;

    private SendOrderDetailsService $service;

    private TeamEmailRecipientService $teamEmailRecipientService;

    private bool $notifyOrganizer = false;

    /** @var string[] */
    private array $sentTo = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->sendAttendeeTicketService = Mockery::mock(SendAttendeeTicketService::class);
        $this->teamEmailRecipientService = Mockery::mock(TeamEmailRecipientService::class);
        $this->teamEmailRecipientService->shouldReceive('newOrderCopies')->andReturn(collect())->byDefault();

        $this->service = new SendOrderDetailsService(
            eventRepository: $this->eventRepository(),
            orderRepository: $this->orderRepository(),
            mailer: $this->mailer(),
            sendAttendeeTicketService: $this->sendAttendeeTicketService,
            mailBuilderService: Mockery::mock(MailBuilderService::class)->shouldIgnoreMissing(),
            teamEmailRecipientService: $this->teamEmailRecipientService,
            logger: Mockery::mock(LoggerInterface::class)->shouldIgnoreMissing(),
        );
    }

    public function test_it_sends_one_email_per_address_carrying_every_ticket_for_it(): void
    {
        // A buyer taking three tickets under their own address used to receive a single ticket,
        // the other two silently dropped.
        $this->attendees = collect([
            $this->attendee(1, 'alex@example.com'),
            $this->attendee(2, 'alex@example.com'),
            $this->attendee(3, 'alex@example.com'),
        ]);

        $captured = [];

        $this->sendAttendeeTicketService
            ->shouldReceive('send')
            ->once()
            ->andReturnUsing(function (...$args) use (&$captured) {
                $captured[] = func_get_args();
            });

        $this->service->sendOrderSummaryAndTicketEmails($this->order());

        $this->assertCount(1, $captured);
    }

    public function test_it_passes_the_remaining_tickets_as_additional_attendees(): void
    {
        $this->attendees = collect([
            $this->attendee(1, 'alex@example.com'),
            $this->attendee(2, 'alex@example.com'),
        ]);

        /** @var Collection|null $additional */
        $additional = null;

        $this->sendAttendeeTicketService
            ->shouldReceive('send')
            ->once()
            ->andReturnUsing(function ($order, $attendee, $event, $eventSettings, $organizer, $additionalAttendees) use (&$additional) {
                $additional = $additionalAttendees;
            });

        $this->service->sendOrderSummaryAndTicketEmails($this->order());

        $this->assertCount(1, $additional);
        $this->assertSame(2, $additional->first()->getId());
    }

    public function test_it_sends_a_separate_email_to_each_distinct_address(): void
    {
        $this->attendees = collect([
            $this->attendee(1, 'alex@example.com'),
            $this->attendee(2, 'robin@example.com'),
            $this->attendee(3, 'alex@example.com'),
        ]);

        $this->sendAttendeeTicketService->shouldReceive('send')->twice();

        $this->service->sendOrderSummaryAndTicketEmails($this->order());

        $this->addToAssertionCount(1);
    }

    public function test_it_treats_addresses_differing_only_in_case_as_one_recipient(): void
    {
        $this->attendees = collect([
            $this->attendee(1, 'alex@example.com'),
            $this->attendee(2, 'Alex@Example.com '),
        ]);

        $this->sendAttendeeTicketService->shouldReceive('send')->once();

        $this->service->sendOrderSummaryAndTicketEmails($this->order());

        $this->addToAssertionCount(1);
    }

    public function test_it_sends_the_new_order_email_to_the_contact_and_each_member_who_asked(): void
    {
        $this->notifyOrganizer = true;
        $this->attendees = collect([$this->attendee(1, 'alex@example.com')]);
        $this->sendAttendeeTicketService->shouldReceive('send');
        $this->teamEmailRecipientService->shouldReceive('newOrderCopies')->andReturn(collect([
            (new UserDomainObject())->setFirstName('Félix')->setLastName('C')->setEmail('felix@example.com'),
        ]));

        $this->service->sendOrderSummaryAndTicketEmails($this->order());

        $this->assertContains('o@example.com', $this->sentTo);
        $this->assertContains('felix@example.com', $this->sentTo);
    }

    public function test_it_sends_no_copy_when_new_order_emails_are_off_for_the_event(): void
    {
        $this->attendees = collect([$this->attendee(1, 'alex@example.com')]);
        $this->sendAttendeeTicketService->shouldReceive('send');
        $this->teamEmailRecipientService->shouldNotReceive('newOrderCopies');

        $this->service->sendOrderSummaryAndTicketEmails($this->order());

        $this->assertNotContains('o@example.com', $this->sentTo);
    }

    public function test_the_contact_still_gets_it_when_the_member_lookup_fails(): void
    {
        $this->notifyOrganizer = true;
        $this->attendees = collect([$this->attendee(1, 'alex@example.com')]);
        $this->sendAttendeeTicketService->shouldReceive('send');
        $this->teamEmailRecipientService->shouldReceive('newOrderCopies')->andThrow(new RuntimeException('db down'));

        $this->service->sendOrderSummaryAndTicketEmails($this->order());

        $this->assertContains('o@example.com', $this->sentTo);
    }

    private function order(): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setId(1)
            ->setEventId(1)
            ->setStatus(OrderStatus::COMPLETED->name)
            ->setEmail('alex@example.com')
            ->setLocale('en');
    }

    private function attendee(int $id, string $email): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())
            ->setId($id)
            ->setEventId(1)
            ->setOrderId(1)
            ->setEmail($email)
            ->setPublicId('A-' . $id)
            ->setShortId('a_' . $id)
            ->setFirstName('Alex')
            ->setLastName('Tremblay')
            ->setLocale('en');
    }

    private function orderRepository(): OrderRepositoryInterface
    {
        $repository = Mockery::mock(OrderRepositoryInterface::class);
        $repository->shouldReceive('loadRelation')->andReturnSelf();
        $repository->shouldReceive('findById')->andReturnUsing(
            fn() => $this->order()->setAttendees($this->attendees)
        );

        return $repository;
    }

    private function eventRepository(): EventRepositoryInterface
    {
        $event = (new EventDomainObject())
            ->setId(1)
            ->setAccountId(1)
            ->setOrganizerId(1)
            ->setTitle('Summer Fest')
            ->setCurrency('CAD')
            ->setTimezone('America/Toronto')
            ->setStartDate('2026-09-01 18:00:00');

        $event->setOrganizer(
            (new OrganizerDomainObject())->setId(1)->setAccountId(1)->setName('DEHORS')->setEmail('o@example.com')
        );
        $event->setEventSettings(
            (new EventSettingDomainObject())->setId(1)->setEventId(1)->setNotifyOrganizerOfNewOrders($this->notifyOrganizer)
        );

        $repository = Mockery::mock(EventRepositoryInterface::class);
        $repository->shouldReceive('loadRelation')->andReturnSelf();
        $repository->shouldReceive('findById')->andReturnUsing(function () use ($event) {
            $event->getEventSettings()->setNotifyOrganizerOfNewOrders($this->notifyOrganizer);

            return $event;
        });

        return $repository;
    }

    private function mailer(): Mailer
    {
        $pendingMail = Mockery::mock(PendingMail::class);
        $pendingMail->shouldReceive('locale')->andReturnSelf();
        $pendingMail->shouldReceive('send')->andReturnNull();

        $mailer = Mockery::mock(Mailer::class);
        $mailer->shouldReceive('to')->andReturnUsing(function ($email) use ($pendingMail) {
            $this->sentTo[] = is_string($email) ? $email : 'other';

            return $pendingMail;
        });

        return $mailer;
    }
}
