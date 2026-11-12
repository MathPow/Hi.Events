<?php

namespace Tests\Unit\Services\Application\Handlers\Organizer;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerMessageDomainObject;
use HiEvents\DomainObjects\Status\OrganizerStatus;
use HiEvents\Jobs\Organizer\SendOrganizerMessagePushJob;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerMessageRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Application\Handlers\Organizer\DTO\SendOrganizerContactMessageDTO;
use HiEvents\Services\Application\Handlers\Organizer\SendOrganizerContactMessageHandler;
use HiEvents\Services\Domain\Organizer\OrganizerMessageRecipientService;
use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Services\Infrastructure\HtmlPurifier\HtmlPurifierService;
use Illuminate\Mail\Mailer;
use Illuminate\Support\Facades\Bus;
use Mockery;
use Mockery\MockInterface;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Tests\TestCase;

class SendOrganizerContactMessageHandlerTest extends TestCase
{
    private Mailer|MockInterface $mailer;
    private OrganizerRepositoryInterface|MockInterface $organizerRepository;
    private OrganizerMessageRepositoryInterface|MockInterface $messageRepository;
    private EventRepositoryInterface|MockInterface $eventRepository;
    private LoggerInterface|MockInterface $logger;
    private OrganizerMessageRecipientService|MockInterface $recipientService;
    private SendOrganizerContactMessageHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake();

        $this->mailer = Mockery::mock(Mailer::class);
        $this->organizerRepository = Mockery::mock(OrganizerRepositoryInterface::class);
        $this->messageRepository = Mockery::mock(OrganizerMessageRepositoryInterface::class);
        $this->eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $this->logger = Mockery::mock(LoggerInterface::class);
        $this->recipientService = Mockery::mock(OrganizerMessageRecipientService::class);
        $this->recipientService->shouldReceive('memberCopies')->andReturn(collect())->byDefault();
        $purifier = Mockery::mock(HtmlPurifierService::class);
        $purifier->shouldReceive('purify')->andReturnUsing(fn(string $html) => $html);

        $this->handler = new SendOrganizerContactMessageHandler(
            $this->mailer,
            $this->organizerRepository,
            $purifier,
            $this->messageRepository,
            $this->eventRepository,
            $this->logger,
            $this->recipientService,
        );
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testStoresTheMessageEmailsItAndQueuesThePush(): void
    {
        $this->organizerRepository->shouldReceive('findById')->with(5)->andReturn($this->organizer());
        $this->eventRepository->shouldReceive('findFirstWhere')
            ->with(['id' => 9, 'organizer_id' => 5])
            ->andReturn((new EventDomainObject())->setId(9));
        $this->messageRepository->shouldReceive('create')->once()->with([
            'organizer_id' => 5,
            'event_id' => 9,
            'sender_name' => 'Marie',
            'sender_email' => 'marie@example.com',
            'message' => 'Bonjour!',
        ])->andReturn((new OrganizerMessageDomainObject())->setId(42));
        $this->expectEmail();

        $this->handler->handle($this->dto(eventId: 9));

        Bus::assertDispatched(SendOrganizerMessagePushJob::class);
    }

    public function testIgnoresAnEventOfAnotherOrganizer(): void
    {
        $this->organizerRepository->shouldReceive('findById')->andReturn($this->organizer());
        $this->eventRepository->shouldReceive('findFirstWhere')->andReturn(null);
        $this->messageRepository->shouldReceive('create')->once()
            ->with(Mockery::on(fn(array $attributes) => $attributes['event_id'] === null))
            ->andReturn((new OrganizerMessageDomainObject())->setId(42));
        $this->expectEmail();

        $this->handler->handle($this->dto(eventId: 77));

        Bus::assertDispatched(SendOrganizerMessagePushJob::class);
    }

    public function testKeepsTheMessageWhenTheEmailFails(): void
    {
        $this->organizerRepository->shouldReceive('findById')->andReturn($this->organizer());
        $this->messageRepository->shouldReceive('create')->once()->andReturn((new OrganizerMessageDomainObject())->setId(42));
        $this->mailer->shouldReceive('to')->andReturnSelf();
        $this->mailer->shouldReceive('send')->andThrow(new RuntimeException('SMTP down'));
        $this->logger->shouldReceive('error')->once();

        $this->handler->handle($this->dto());

        Bus::assertDispatched(SendOrganizerMessagePushJob::class);
    }

    public function testSendsACopyToEachMemberWhoAskedForOne(): void
    {
        $this->organizerRepository->shouldReceive('findById')->andReturn($this->organizer());
        $this->messageRepository->shouldReceive('create')->once()->andReturn((new OrganizerMessageDomainObject())->setId(42));
        $this->recipientService->shouldReceive('memberCopies')->andReturn(collect([
            (new UserDomainObject())->setFirstName('Félix')->setLastName('C')->setEmail('felix@example.com'),
        ]));
        $this->mailer->shouldReceive('to')->once()->with('club@example.com', 'Club')->andReturnSelf();
        $this->mailer->shouldReceive('to')->once()->with('felix@example.com', 'Félix C')->andReturnSelf();
        $this->mailer->shouldReceive('send')->twice();

        $this->handler->handle($this->dto());

        Bus::assertDispatched(SendOrganizerMessagePushJob::class);
    }

    public function testStillEmailsTheContactWhenTheMemberLookupFails(): void
    {
        $this->organizerRepository->shouldReceive('findById')->andReturn($this->organizer());
        $this->messageRepository->shouldReceive('create')->once()->andReturn((new OrganizerMessageDomainObject())->setId(42));
        $this->recipientService->shouldReceive('memberCopies')->andThrow(new RuntimeException('db down'));
        $this->logger->shouldReceive('error')->once();
        $this->expectEmail();

        $this->handler->handle($this->dto());
    }

    public function testRefusesAnOrganizerThatIsNotLive(): void
    {
        $this->expectException(ResourceNotFoundException::class);

        $this->organizerRepository->shouldReceive('findById')
            ->andReturn($this->organizer()->setStatus(OrganizerStatus::DRAFT->value));
        $this->messageRepository->shouldNotReceive('create');

        $this->handler->handle($this->dto());
    }

    private function expectEmail(): void
    {
        $this->mailer->shouldReceive('to')->once()->with('club@example.com', 'Club')->andReturnSelf();
        $this->mailer->shouldReceive('send')->once();
    }

    private function organizer(): OrganizerDomainObject
    {
        return (new OrganizerDomainObject())
            ->setId(5)
            ->setAccountId(3)
            ->setName('Club')
            ->setEmail('club@example.com')
            ->setStatus(OrganizerStatus::LIVE->value);
    }

    private function dto(?int $eventId = null): SendOrganizerContactMessageDTO
    {
        return new SendOrganizerContactMessageDTO(
            organizer_id: 5,
            account_id: null,
            name: 'Marie',
            email: 'marie@example.com',
            message: 'Bonjour!',
            event_id: $eventId,
        );
    }
}
