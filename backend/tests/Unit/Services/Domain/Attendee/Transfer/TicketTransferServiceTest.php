<?php

namespace Tests\Unit\Services\Domain\Attendee\Transfer;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\Enums\TicketTransferRefusal;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\Exceptions\TicketTransferNotAllowedException;
use HiEvents\Mail\Attendee\AttendeeTicketTransferredMail;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\AttendeeTransferRepositoryInterface;
use HiEvents\Services\Domain\Attendee\SendAttendeeTicketService;
use HiEvents\Services\Domain\Attendee\Transfer\DTO\TicketTransferRecipientDTO;
use HiEvents\Services\Domain\Attendee\Transfer\TicketTransferPolicy;
use HiEvents\Services\Domain\Attendee\Transfer\TicketTransferService;
use HiEvents\Services\Domain\Document\OrderDocumentCopyService;
use HiEvents\Services\Domain\Question\ParticipantDetailsService;
use HiEvents\Services\Infrastructure\DomainEvents\DomainEventDispatcherService;
use HiEvents\Services\Infrastructure\DomainEvents\Enums\DomainEventType;
use HiEvents\Services\Infrastructure\DomainEvents\Events\AttendeeEvent;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Facades\Mail;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class TicketTransferServiceTest extends TestCase
{
    private TicketTransferPolicy|MockInterface $policy;
    private AttendeeRepositoryInterface|MockInterface $attendeeRepository;
    private AttendeeTransferRepositoryInterface|MockInterface $transferRepository;
    private ParticipantDetailsService|MockInterface $participantDetails;
    private OrderDocumentCopyService|MockInterface $documentCopies;
    private SendAttendeeTicketService|MockInterface $ticketSender;
    private DomainEventDispatcherService|MockInterface $domainEvents;
    private TicketTransferService $service;

    private array $updatedAttributes = [];
    private array $updatedWhere = [];
    private string $buyerEmail = 'buyer@example.com';

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();

        $this->policy = Mockery::mock(TicketTransferPolicy::class);
        $this->policy->shouldReceive('assertCanTransfer')->byDefault();
        $this->attendeeRepository = Mockery::mock(AttendeeRepositoryInterface::class);
        $this->attendeeRepository->shouldReceive('loadRelation')->andReturnSelf()->byDefault();
        $this->attendeeRepository->shouldReceive('updateWhere')
            ->andReturnUsing(function (array $attributes, array $where) {
                $this->updatedAttributes = $attributes;
                $this->updatedWhere = $where;
                return 1;
            })
            ->byDefault();
        $this->attendeeRepository->shouldReceive('findById')->with(10)->andReturnUsing(fn() => $this->transferredAttendee())->byDefault();
        $this->transferRepository = Mockery::mock(AttendeeTransferRepositoryInterface::class);
        $this->transferRepository->shouldReceive('create')->byDefault();
        $this->participantDetails = Mockery::mock(ParticipantDetailsService::class);
        $this->participantDetails->shouldReceive('eraseAnswers')->byDefault();
        $this->documentCopies = Mockery::mock(OrderDocumentCopyService::class);
        $this->documentCopies->shouldReceive('deleteForAttendee', 'replaceUnsignedForAttendee')->byDefault();
        $this->ticketSender = Mockery::mock(SendAttendeeTicketService::class);
        $this->ticketSender->shouldReceive('send')->byDefault();

        $this->domainEvents = Mockery::mock(DomainEventDispatcherService::class);
        $this->domainEvents->shouldReceive('dispatch')->byDefault();

        $database = Mockery::mock(DatabaseManager::class);
        $database->shouldReceive('transaction')->andReturnUsing(fn(callable $callback) => $callback());

        $this->service = new TicketTransferService(
            policy: $this->policy,
            attendeeRepository: $this->attendeeRepository,
            attendeeTransferRepository: $this->transferRepository,
            participantDetailsService: $this->participantDetails,
            orderDocumentCopyService: $this->documentCopies,
            sendAttendeeTicketService: $this->ticketSender,
            domainEventDispatcherService: $this->domainEvents,
            databaseManager: $database,
        );
    }

    public function test_the_ticket_gets_the_new_holder_and_new_ids(): void
    {
        $this->transfer();

        $this->assertSame('Marie', $this->updatedAttributes['first_name']);
        $this->assertSame('Tremblay', $this->updatedAttributes['last_name']);
        $this->assertSame('marie@example.com', $this->updatedAttributes['email']);
        $this->assertStringStartsWith('a_', $this->updatedAttributes['short_id']);
        $this->assertNotSame('a_oldshortid1', $this->updatedAttributes['short_id']);
        $this->assertStringStartsWith('A-', $this->updatedAttributes['public_id']);
        $this->assertNotSame('A-OLDQR12', $this->updatedAttributes['public_id']);
        // Only the ticket as it was read changes.
        $this->assertSame(['id' => 10, 'short_id' => 'a_oldshortid1'], $this->updatedWhere);
    }

    public function test_the_bib_number_and_the_product_are_kept(): void
    {
        $this->transfer();

        $this->assertArrayNotHasKey('bib_number', $this->updatedAttributes);
        $this->assertArrayNotHasKey('product_id', $this->updatedAttributes);
        $this->assertArrayNotHasKey('product_price_id', $this->updatedAttributes);
        $this->assertArrayNotHasKey('order_id', $this->updatedAttributes);
    }

    public function test_the_previous_holder_waiver_signature_is_voided(): void
    {
        $this->transfer();

        foreach (['waiver_id', 'waiver_signed_name', 'waiver_guardian_name', 'waiver_signed_at', 'waiver_ip_address'] as $column) {
            $this->assertArrayHasKey($column, $this->updatedAttributes);
            $this->assertNull($this->updatedAttributes[$column]);
        }
    }

    public function test_the_previous_holder_documents_are_voided_and_new_ones_wait_for_the_new_holder(): void
    {
        $this->documentCopies->shouldReceive('deleteForAttendee')->once()->with(10)->ordered();
        $this->documentCopies->shouldReceive('replaceUnsignedForAttendee')
            ->once()
            ->withArgs(fn(AttendeeDomainObject $attendee, ?string $dateOfBirth, string $locale) => $attendee->getFirstName() === 'Marie'
                && $dateOfBirth === null
                && $locale === 'fr')
            ->ordered();

        $this->transfer();
    }

    public function test_the_previous_holder_participant_answers_are_erased(): void
    {
        $this->participantDetails->shouldReceive('eraseAnswers')
            ->once()
            ->withArgs(fn(AttendeeDomainObject $attendee) => $attendee->getId() === 10);

        $this->transfer();
    }

    public function test_the_transfer_is_recorded(): void
    {
        $this->transferRepository->shouldReceive('create')->once()->with([
            'event_id' => 1,
            'attendee_id' => 10,
            'from_first_name' => 'Léo',
            'from_last_name' => 'Gagnon',
            'from_email' => 'leo@example.com',
            'to_first_name' => 'Marie',
            'to_last_name' => 'Tremblay',
            'to_email' => 'marie@example.com',
            'ip_address' => '1.2.3.4',
        ]);

        $this->transfer();
    }

    public function test_integrations_are_told_the_attendee_changed(): void
    {
        $this->domainEvents->shouldReceive('dispatch')
            ->once()
            ->withArgs(fn(AttendeeEvent $event) => $event->type === DomainEventType::ATTENDEE_UPDATED && $event->attendeeId === 10);

        $this->transfer();
    }

    public function test_the_new_holder_receives_the_ticket(): void
    {
        $this->ticketSender->shouldReceive('send')
            ->once()
            ->withArgs(fn(OrderDomainObject $order, AttendeeDomainObject $attendee) => $attendee->getEmail() === 'marie@example.com'
                && $order->getId() === 5);

        $this->transfer();
    }

    public function test_the_previous_holder_and_the_buyer_are_told(): void
    {
        $this->transfer();

        Mail::assertQueued(AttendeeTicketTransferredMail::class, 2);
        Mail::assertQueued(AttendeeTicketTransferredMail::class, fn(AttendeeTicketTransferredMail $mail) => $mail->hasTo('leo@example.com')
            && $this->mailData($mail)['newHolderName'] === 'Marie T.'
            && $this->mailData($mail)['toBuyer'] === false);
        Mail::assertQueued(AttendeeTicketTransferredMail::class, fn(AttendeeTicketTransferredMail $mail) => $mail->hasTo('buyer@example.com')
            && $this->mailData($mail)['previousHolderName'] === 'Léo Gagnon'
            && $this->mailData($mail)['toBuyer'] === true);
    }

    public function test_a_buyer_who_held_the_ticket_is_told_once(): void
    {
        $this->transfer(buyerEmail: 'LEO@example.com');

        Mail::assertQueued(AttendeeTicketTransferredMail::class, 1);
        Mail::assertQueued(AttendeeTicketTransferredMail::class, fn(AttendeeTicketTransferredMail $mail) => $mail->hasTo('leo@example.com'));
    }

    public function test_a_buyer_who_gets_the_ticket_back_only_receives_the_ticket(): void
    {
        $this->transfer(buyerEmail: 'marie@example.com');

        Mail::assertQueued(AttendeeTicketTransferredMail::class, 1);
        Mail::assertNotQueued(AttendeeTicketTransferredMail::class, fn(AttendeeTicketTransferredMail $mail) => $mail->hasTo('marie@example.com'));
    }

    public function test_a_refused_transfer_changes_nothing(): void
    {
        $this->policy->shouldReceive('assertCanTransfer')->andThrow(new TicketTransferNotAllowedException(TicketTransferRefusal::DEADLINE_PASSED));
        $this->attendeeRepository->shouldNotReceive('updateWhere');
        $this->transferRepository->shouldNotReceive('create');
        $this->ticketSender->shouldNotReceive('send');

        try {
            $this->transfer();
            $this->fail('Expected TicketTransferNotAllowedException');
        } catch (TicketTransferNotAllowedException $exception) {
            $this->assertSame(TicketTransferRefusal::DEADLINE_PASSED, $exception->refusal);
        }

        Mail::assertNothingQueued();
    }

    public function test_a_ticket_transferred_meanwhile_is_not_transferred_twice(): void
    {
        $this->attendeeRepository->shouldReceive('updateWhere')->andReturn(0);
        $this->transferRepository->shouldNotReceive('create');
        $this->ticketSender->shouldNotReceive('send');

        try {
            $this->transfer();
            $this->fail('Expected TicketTransferNotAllowedException');
        } catch (TicketTransferNotAllowedException $exception) {
            $this->assertSame(TicketTransferRefusal::TICKET_NOT_ACTIVE, $exception->refusal);
        }

        Mail::assertNothingQueued();
    }

    private function transfer(string $buyerEmail = 'buyer@example.com'): AttendeeDomainObject
    {
        $this->buyerEmail = $buyerEmail;

        return $this->service->transfer(
            attendee: $this->attendee(),
            order: $this->order(),
            event: $this->event(),
            recipient: new TicketTransferRecipientDTO(first_name: ' Marie ', last_name: 'Tremblay', email: 'marie@example.com '),
            ipAddress: '1.2.3.4',
        );
    }

    private function attendee(): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())
            ->setId(10)
            ->setEventId(1)
            ->setOrderId(5)
            ->setProductId(3)
            ->setStatus('ACTIVE')
            ->setFirstName('Léo')
            ->setLastName('Gagnon')
            ->setEmail('leo@example.com')
            ->setShortId('a_oldshortid1')
            ->setPublicId('A-OLDQR12')
            ->setBibNumber(42)
            ->setLocale('fr');
    }

    private function transferredAttendee(): AttendeeDomainObject
    {
        $attendee = $this->attendee()
            ->setFirstName('Marie')
            ->setLastName('Tremblay')
            ->setEmail('marie@example.com')
            ->setShortId('a_newshortid1')
            ->setPublicId('A-NEWQR12');
        $attendee->setOrder($this->order());
        $attendee->setProduct((new ProductDomainObject())->setId(3)->setTitle('10 km'));

        return $attendee;
    }

    private function order(): OrderDomainObject
    {
        return (new OrderDomainObject())
            ->setId(5)
            ->setStatus('COMPLETED')
            ->setEmail($this->buyerEmail)
            ->setLocale('fr');
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject())
            ->setId(1)
            ->setTitle('10 km de Québec')
            ->setEventSettings((new EventSettingDomainObject())->setAllowTicketTransfer(true)->setSupportEmail('org@example.com'))
            ->setOrganizer((new OrganizerDomainObject())->setId(2)->setName('Club Dehors'));
    }

    private function mailData(AttendeeTicketTransferredMail $mail): array
    {
        $data = [];
        foreach ((new \ReflectionClass($mail))->getProperties() as $property) {
            $data[$property->getName()] = $property->getValue($mail);
        }

        return $data;
    }
}
