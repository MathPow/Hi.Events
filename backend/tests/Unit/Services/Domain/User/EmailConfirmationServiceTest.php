<?php

namespace Tests\Unit\Services\Domain\User;

use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Mail\Account\ConfirmEmailAddressEmail;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Domain\User\EmailConfirmationService;
use HiEvents\Services\Domain\User\VerifyUserEmailService;
use HiEvents\Services\Infrastructure\Encryption\EncryptedPayloadService;
use HiEvents\Services\Infrastructure\User\EmailVerificationCodeService;
use Illuminate\Contracts\Mail\Mailer;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Mockery as m;
use Tests\TestCase;

class EmailConfirmationServiceTest extends TestCase
{
    private Mailer $mailer;
    private EncryptedPayloadService $encryptedPayloadService;
    private VerifyUserEmailService $verifyUserEmailService;
    private EventRepositoryInterface $eventRepository;
    private EmailConfirmationService $service;
    private UserDomainObject $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->mailer = m::mock(Mailer::class);
        $this->encryptedPayloadService = m::mock(EncryptedPayloadService::class);
        $this->verifyUserEmailService = m::mock(VerifyUserEmailService::class);
        $this->eventRepository = m::mock(EventRepositoryInterface::class);

        $this->service = new EmailConfirmationService(
            $this->mailer,
            $this->encryptedPayloadService,
            m::mock(UserRepositoryInterface::class),
            m::mock(DatabaseManager::class),
            m::mock(EmailVerificationCodeService::class),
            $this->verifyUserEmailService,
            $this->eventRepository,
        );

        $this->user = (new UserDomainObject())->setId(1)->setEmail('test@example.com');
    }

    public function testSendConfirmationEmailsALink(): void
    {
        config(['app.skip_email_verification' => false]);

        $this->eventRepository->shouldReceive('findWhere')->once()->andReturn(new Collection());
        $this->encryptedPayloadService->shouldReceive('encryptPayload')->once()->andReturn('token');
        $this->verifyUserEmailService->shouldNotReceive('markEmailAsVerified');

        $pendingMail = m::mock('PendingMail');
        $this->mailer->shouldReceive('to')->once()->with('test@example.com')->andReturn($pendingMail);
        $pendingMail->shouldReceive('send')->once()->with(m::type(ConfirmEmailAddressEmail::class));

        $this->service->sendConfirmation($this->user, 10);

        $this->assertTrue(true);
    }

    public function testSendConfirmationVerifiesAtOnceWhenEmailVerificationIsSkipped(): void
    {
        config(['app.skip_email_verification' => true]);

        $this->verifyUserEmailService->shouldReceive('markEmailAsVerified')->once()->with($this->user, 10);
        $this->mailer->shouldNotReceive('to');

        $this->service->sendConfirmation($this->user, 10);

        $this->assertTrue(true);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
