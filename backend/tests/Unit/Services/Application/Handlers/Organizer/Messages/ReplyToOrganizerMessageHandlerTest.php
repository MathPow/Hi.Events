<?php

namespace Tests\Unit\Services\Application\Handlers\Organizer\Messages;

use HiEvents\DomainObjects\AccountDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerMessageDomainObject;
use HiEvents\Exceptions\AccountNotVerifiedException;
use HiEvents\Mail\Organizer\OrganizerContactReplyEmail;
use HiEvents\Repository\Interfaces\AccountRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerMessageRepositoryInterface;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Application\Handlers\Organizer\Messages\DTO\ReplyToOrganizerMessageDTO;
use HiEvents\Services\Application\Handlers\Organizer\Messages\ReplyToOrganizerMessageHandler;
use Illuminate\Mail\Mailer;
use Mockery;
use Mockery\MockInterface;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Tests\TestCase;

class ReplyToOrganizerMessageHandlerTest extends TestCase
{
    private OrganizerMessageRepositoryInterface|MockInterface $messageRepository;
    private OrganizerRepositoryInterface|MockInterface $organizerRepository;
    private AccountRepositoryInterface|MockInterface $accountRepository;
    private Mailer|MockInterface $mailer;
    private ReplyToOrganizerMessageHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->messageRepository = Mockery::mock(OrganizerMessageRepositoryInterface::class);
        $this->organizerRepository = Mockery::mock(OrganizerRepositoryInterface::class);
        $this->accountRepository = Mockery::mock(AccountRepositoryInterface::class);
        $this->mailer = Mockery::mock(Mailer::class);

        $this->handler = new ReplyToOrganizerMessageHandler(
            $this->messageRepository,
            $this->organizerRepository,
            $this->accountRepository,
            $this->mailer,
        );
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testEmailsTheSenderAndMarksTheMessageRepliedAndRead(): void
    {
        $message = $this->message();
        $this->messageRepository->shouldReceive('findFirstWhere')
            ->with(['id' => 42, 'organizer_id' => 5])
            ->andReturn($message);
        $this->organizerRepository->shouldReceive('findById')->with(5)->andReturn($this->organizer());
        $this->accountRepository->shouldReceive('findById')->with(3)->andReturn($this->account(verified: true));

        $this->mailer->shouldReceive('to')->once()->with('marie@example.com', 'Marie')->andReturnSelf();
        $this->mailer->shouldReceive('locale')->once()->with('fr')->andReturnSelf();
        $this->mailer->shouldReceive('send')->once()->with(Mockery::type(OrganizerContactReplyEmail::class));

        $this->messageRepository->shouldReceive('updateFromArray')->once()
            ->with(42, Mockery::on(fn(array $attributes) => is_string($attributes['replied_at'])
                && $attributes['read_at'] === $attributes['replied_at']))
            ->andReturn($message);
        $this->messageRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->messageRepository->shouldReceive('findById')->with(42)->andReturn($message);

        $result = $this->handler->handle($this->dto());

        $this->assertSame($message, $result);
    }

    public function testKeepsTheFirstReadDate(): void
    {
        $message = $this->message()->setReadAt('2026-10-30 10:00:00');
        $this->messageRepository->shouldReceive('findFirstWhere')->andReturn($message);
        $this->organizerRepository->shouldReceive('findById')->andReturn($this->organizer());
        $this->accountRepository->shouldReceive('findById')->andReturn($this->account(verified: true));
        $this->mailer->shouldReceive('to')->andReturnSelf();
        $this->mailer->shouldReceive('locale')->andReturnSelf();
        $this->mailer->shouldReceive('send')->once();

        $this->messageRepository->shouldReceive('updateFromArray')->once()
            ->with(42, Mockery::on(fn(array $attributes) => $attributes['read_at'] === '2026-10-30 10:00:00'))
            ->andReturn($message);
        $this->messageRepository->shouldReceive('loadRelation')->andReturnSelf();
        $this->messageRepository->shouldReceive('findById')->andReturn($message);

        $this->assertSame($message, $this->handler->handle($this->dto()));
    }

    public function testTheEmailShowsTheAnswerAndTheOriginalMessage(): void
    {
        $email = new OrganizerContactReplyEmail(
            organizer: $this->organizer(),
            message: $this->message(),
            reply: "Oui, en laisse.\nÀ bientôt",
        );

        $html = $email->render();

        $this->assertStringContainsString('Oui, en laisse.<br>', $html);
        $this->assertStringContainsString('Est-ce que les chiens sont admis?', $html);
        $email->assertHasReplyTo('club@example.com', 'Club');
    }

    public function testRefusesAMessageOfAnotherOrganizer(): void
    {
        $this->expectException(ResourceNotFoundException::class);

        $this->messageRepository->shouldReceive('findFirstWhere')->andReturn(null);
        $this->mailer->shouldNotReceive('to');
        $this->messageRepository->shouldNotReceive('updateFromArray');

        $this->handler->handle($this->dto());
    }

    public function testRefusesAnAccountWhoseEmailIsNotConfirmed(): void
    {
        $this->expectException(AccountNotVerifiedException::class);

        $this->messageRepository->shouldReceive('findFirstWhere')->andReturn($this->message());
        $this->organizerRepository->shouldReceive('findById')->andReturn($this->organizer());
        $this->accountRepository->shouldReceive('findById')->andReturn($this->account(verified: false));
        $this->mailer->shouldNotReceive('to');
        $this->messageRepository->shouldNotReceive('updateFromArray');

        $this->handler->handle($this->dto());
    }

    private function dto(): ReplyToOrganizerMessageDTO
    {
        return new ReplyToOrganizerMessageDTO(organizer_id: 5, message_id: 42, reply: "  Bonjour Marie,\nOui!  ", locale: 'fr');
    }

    private function message(): OrganizerMessageDomainObject
    {
        return (new OrganizerMessageDomainObject())
            ->setId(42)
            ->setOrganizerId(5)
            ->setSenderName('Marie')
            ->setSenderEmail('marie@example.com')
            ->setMessage('Est-ce que les chiens sont admis?');
    }

    private function organizer(): OrganizerDomainObject
    {
        return (new OrganizerDomainObject())
            ->setId(5)
            ->setAccountId(3)
            ->setName('Club')
            ->setEmail('club@example.com');
    }

    private function account(bool $verified): AccountDomainObject
    {
        return (new AccountDomainObject())
            ->setId(3)
            ->setAccountVerifiedAt($verified ? '2026-01-01 00:00:00' : null);
    }
}
