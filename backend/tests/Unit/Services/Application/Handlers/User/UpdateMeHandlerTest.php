<?php

namespace Tests\Unit\Services\Application\Handlers\User;

use HiEvents\DomainObjects\UserDomainObject;
use HiEvents\Mail\User\ConfirmEmailChangeMail;
use HiEvents\Repository\Interfaces\UserRepositoryInterface;
use HiEvents\Services\Application\Handlers\User\DTO\UpdateMeDTO;
use HiEvents\Services\Application\Handlers\User\UpdateMeHandler;
use HiEvents\Services\Infrastructure\Encryption\EncryptedPayloadService;
use Illuminate\Contracts\Hashing\Hasher;
use Illuminate\Contracts\Mail\Mailer;
use Mockery as m;
use Tests\TestCase;

class UpdateMeHandlerTest extends TestCase
{
    private UserRepositoryInterface $userRepository;
    private Mailer $mailer;
    private EncryptedPayloadService $encryptedPayloadService;
    private UpdateMeHandler $handler;
    private UserDomainObject $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->userRepository = m::mock(UserRepositoryInterface::class);
        $this->mailer = m::mock(Mailer::class);
        $this->encryptedPayloadService = m::mock(EncryptedPayloadService::class);

        $this->handler = new UpdateMeHandler(
            $this->userRepository,
            m::mock(Hasher::class),
            $this->mailer,
            $this->encryptedPayloadService,
        );

        $this->user = (new UserDomainObject())->setId(1)->setEmail('old@example.com')->setLocale('fr');
        $this->userRepository->shouldReceive('findByIdAndAccountId')->with(1, 10)->andReturn($this->user);
    }

    public function testChangingEmailWaitsForConfirmation(): void
    {
        config(['app.skip_email_verification' => false]);

        $this->encryptedPayloadService->shouldReceive('encryptPayload')->once()->andReturn('token');
        $pendingMail = m::mock('PendingMail');
        $this->mailer->shouldReceive('to')->once()->with('old@example.com')->andReturn($pendingMail);
        $pendingMail->shouldReceive('locale')->once()->with('fr')->andReturnSelf();
        $pendingMail->shouldReceive('send')->once()->with(m::type(ConfirmEmailChangeMail::class));

        $this->userRepository->shouldReceive('updateWhere')->once()->withArgs(
            fn(array $attributes) => $attributes['pending_email'] === 'new@example.com' && !isset($attributes['email'])
        );

        $this->handler->handle($this->changeEmail());

        $this->assertTrue(true);
    }

    public function testChangingEmailAppliesAtOnceWhenEmailVerificationIsSkipped(): void
    {
        config(['app.skip_email_verification' => true]);

        $this->mailer->shouldNotReceive('to');
        $this->userRepository->shouldReceive('updateWhere')->once()->withArgs(
            fn(array $attributes) => $attributes['email'] === 'new@example.com' && !isset($attributes['pending_email'])
        );

        $this->handler->handle($this->changeEmail());

        $this->assertTrue(true);
    }

    private function changeEmail(): UpdateMeDTO
    {
        return new UpdateMeDTO(
            id: 1,
            account_id: 10,
            first_name: 'Test',
            last_name: 'User',
            email: 'new@example.com',
            timezone: 'America/Toronto',
            password: null,
            current_password: null,
            locale: 'fr',
        );
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
