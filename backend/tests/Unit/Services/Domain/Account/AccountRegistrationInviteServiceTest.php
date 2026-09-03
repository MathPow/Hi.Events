<?php

namespace Tests\Unit\Services\Domain\Account;

use HiEvents\DomainObjects\AccountRegistrationInviteDomainObject;
use HiEvents\Exceptions\InvalidRegistrationInviteException;
use HiEvents\Repository\Interfaces\AccountRegistrationInviteRepositoryInterface;
use HiEvents\Services\Domain\Account\AccountRegistrationInviteService;
use Illuminate\Support\Carbon;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class AccountRegistrationInviteServiceTest extends TestCase
{
    private AccountRegistrationInviteService $service;
    private MockInterface|AccountRegistrationInviteRepositoryInterface $inviteRepository;

    protected function setUp(): void
    {
        parent::setUp();

        $this->inviteRepository = Mockery::mock(AccountRegistrationInviteRepositoryInterface::class);
        $this->service = new AccountRegistrationInviteService($this->inviteRepository);
    }

    public function testCreateStoresOnlyTheTokenHashAndReturnsTheLink(): void
    {
        $this->inviteRepository
            ->shouldReceive('create')
            ->once()
            ->withArgs(function (array $attributes) {
                return strlen($attributes['token_hash']) === 64
                    && $attributes['email'] === 'guest@example.com'
                    && $attributes['created_by_user_id'] === 7
                    && Carbon::parse($attributes['expires_at'])->isFuture();
            })
            ->andReturn($this->makeInvite());

        $created = $this->service->create(
            email: '  Guest@Example.com ',
            label: 'A friend',
            expiresInDays: 7,
            createdByUserId: 7,
        );

        $this->assertStringContainsString('/auth/register?registration_token=', $created->registrationUrl);
    }

    public function testFindUsableByTokenLooksUpTheHashNotTheToken(): void
    {
        $invite = $this->makeInvite();

        $this->inviteRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with(['token_hash' => hash('sha256', 'plain-token')])
            ->andReturn($invite);

        $this->assertSame($invite, $this->service->findUsableByToken('plain-token'));
    }

    public function testUnknownTokenIsRejected(): void
    {
        $this->inviteRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->andReturnNull();

        $this->expectException(InvalidRegistrationInviteException::class);

        $this->service->findUsableByToken('nope');
    }

    public function testUsedTokenIsRejected(): void
    {
        $this->inviteRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->andReturn($this->makeInvite(usedAt: '2026-01-01 00:00:00'));

        $this->expectException(InvalidRegistrationInviteException::class);

        $this->service->findUsableByToken('plain-token');
    }

    public function testRevokedTokenIsRejected(): void
    {
        $this->inviteRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->andReturn($this->makeInvite(revokedAt: '2026-01-01 00:00:00'));

        $this->expectException(InvalidRegistrationInviteException::class);

        $this->service->findUsableByToken('plain-token');
    }

    public function testExpiredTokenIsRejected(): void
    {
        $this->inviteRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->andReturn($this->makeInvite(expiresAt: Carbon::now()->subDay()->toDateTimeString()));

        $this->expectException(InvalidRegistrationInviteException::class);

        $this->service->findUsableByToken('plain-token');
    }

    public function testEmailBoundInviteRejectsAnotherEmail(): void
    {
        $this->expectException(InvalidRegistrationInviteException::class);

        $this->service->assertUsableForEmail($this->makeInvite(), 'someone@else.com');
    }

    public function testEmailBoundInviteIgnoresCaseAndSurroundingSpace(): void
    {
        $this->service->assertUsableForEmail($this->makeInvite(), ' Guest@Example.COM ');

        $this->assertTrue(true);
    }

    public function testOpenInviteAcceptsAnyEmail(): void
    {
        $this->service->assertUsableForEmail($this->makeInvite(email: null), 'anyone@example.com');

        $this->assertTrue(true);
    }

    public function testConsumeOnlyMatchesAnUnusedInvite(): void
    {
        $this->inviteRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->withArgs(function (array $attributes, array $where) {
                return $where['id'] === 1
                    && $where['used_at'] === ['used_at', 'null', null]
                    && $attributes['used_by_account_id'] === 42;
            })
            ->andReturn(1);

        $this->service->consume($this->makeInvite(), 42);

        $this->assertTrue(true);
    }

    public function testConsumeFailsWhenTheInviteWasAlreadyTaken(): void
    {
        $this->inviteRepository
            ->shouldReceive('updateWhere')
            ->once()
            ->andReturn(0);

        $this->expectException(InvalidRegistrationInviteException::class);

        $this->service->consume($this->makeInvite(), 42);
    }

    private function makeInvite(
        ?string $email = 'guest@example.com',
        ?string $expiresAt = null,
        ?string $usedAt = null,
        ?string $revokedAt = null,
    ): AccountRegistrationInviteDomainObject
    {
        return (new AccountRegistrationInviteDomainObject())
            ->setId(1)
            ->setTokenHash(hash('sha256', 'plain-token'))
            ->setEmail($email)
            ->setExpiresAt($expiresAt)
            ->setUsedAt($usedAt)
            ->setRevokedAt($revokedAt);
    }
}
