<?php

namespace Tests\Unit\Services\Application\Handlers\Affiliate;

use HiEvents\DomainObjects\AffiliateDomainObject;
use HiEvents\DomainObjects\Status\AffiliateStatus;
use HiEvents\Exceptions\ResourceConflictException;
use HiEvents\Repository\Interfaces\AffiliateRepositoryInterface;
use HiEvents\Services\Domain\Affiliate\AffiliatePromoCodeValidationService;
use HiEvents\Services\Application\Handlers\Affiliate\CreateAffiliateHandler;
use HiEvents\Services\Application\Handlers\Affiliate\DTO\UpsertAffiliateDTO;
use Mockery as m;
use Tests\TestCase;

class CreateAffiliateHandlerTest extends TestCase
{
    private AffiliateRepositoryInterface $affiliateRepository;
    private AffiliatePromoCodeValidationService $promoCodeValidationService;
    private CreateAffiliateHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->affiliateRepository = m::mock(AffiliateRepositoryInterface::class);
        $this->promoCodeValidationService = m::mock(AffiliatePromoCodeValidationService::class);
        $this->promoCodeValidationService->shouldReceive('assertPromoCodeBelongsToEvent')->byDefault();
        $this->handler = new CreateAffiliateHandler($this->affiliateRepository, $this->promoCodeValidationService);
    }

    private function matchesCreatePayload(array $expected, array $actual): bool
    {
        $token = $actual['public_token'] ?? null;
        unset($actual['public_token']);

        return is_string($token) && strlen($token) === 48 && $expected === $actual;
    }

    public function testHandleSuccessfullyCreatesAffiliate(): void
    {
        $eventId = 1;
        $accountId = 2;
        $dto = new UpsertAffiliateDTO(
            name: 'Test Affiliate',
            code: 'test123',
            email: 'test@example.com',
            status: AffiliateStatus::ACTIVE
        );

        $expectedCode = 'TEST123';
        $expectedAffiliate = m::mock(AffiliateDomainObject::class);

        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with([
                'event_id' => $eventId,
                'code' => $expectedCode,
            ])
            ->andReturn(null);

        $this->affiliateRepository
            ->shouldReceive('create')
            ->once()
            ->with(m::on(fn(array $data) => $this->matchesCreatePayload([
                'event_id' => $eventId,
                'account_id' => $accountId,
                'name' => 'Test Affiliate',
                'code' => $expectedCode,
                'email' => 'test@example.com',
                'status' => AffiliateStatus::ACTIVE->value,
                'promo_code_id' => null,
            ], $data)))
            ->andReturn($expectedAffiliate);

        $result = $this->handler->handle($eventId, $accountId, $dto);

        $this->assertSame($expectedAffiliate, $result);
    }

    public function testHandleSuccessfullyCreatesAffiliateWithoutEmail(): void
    {
        $eventId = 1;
        $accountId = 2;
        $dto = new UpsertAffiliateDTO(
            name: 'Test Affiliate',
            code: 'test123',
            email: null,
            status: AffiliateStatus::INACTIVE
        );

        $expectedCode = 'TEST123';
        $expectedAffiliate = m::mock(AffiliateDomainObject::class);

        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with([
                'event_id' => $eventId,
                'code' => $expectedCode,
            ])
            ->andReturn(null);

        $this->affiliateRepository
            ->shouldReceive('create')
            ->once()
            ->with(m::on(fn(array $data) => $this->matchesCreatePayload([
                'event_id' => $eventId,
                'account_id' => $accountId,
                'name' => 'Test Affiliate',
                'code' => $expectedCode,
                'email' => null,
                'status' => AffiliateStatus::INACTIVE->value,
                'promo_code_id' => null,
            ], $data)))
            ->andReturn($expectedAffiliate);

        $result = $this->handler->handle($eventId, $accountId, $dto);

        $this->assertSame($expectedAffiliate, $result);
    }

    public function testHandleConvertsCodeToUppercase(): void
    {
        $eventId = 1;
        $accountId = 2;
        $dto = new UpsertAffiliateDTO(
            name: 'Test Affiliate',
            code: 'lowercase_code',
            email: 'test@example.com',
            status: AffiliateStatus::ACTIVE
        );

        $expectedCode = 'LOWERCASE_CODE';
        $expectedAffiliate = m::mock(AffiliateDomainObject::class);

        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with([
                'event_id' => $eventId,
                'code' => $expectedCode,
            ])
            ->andReturn(null);

        $this->affiliateRepository
            ->shouldReceive('create')
            ->once()
            ->with(m::on(fn(array $data) => $this->matchesCreatePayload([
                'event_id' => $eventId,
                'account_id' => $accountId,
                'name' => 'Test Affiliate',
                'code' => $expectedCode,
                'email' => 'test@example.com',
                'status' => AffiliateStatus::ACTIVE->value,
                'promo_code_id' => null,
            ], $data)))
            ->andReturn($expectedAffiliate);

        $result = $this->handler->handle($eventId, $accountId, $dto);

        $this->assertSame($expectedAffiliate, $result);
    }

    public function testHandleThrowsExceptionWhenAffiliateCodeAlreadyExists(): void
    {
        $eventId = 1;
        $accountId = 2;
        $dto = new UpsertAffiliateDTO(
            name: 'Test Affiliate',
            code: 'existing_code',
            email: 'test@example.com',
            status: AffiliateStatus::ACTIVE
        );

        $expectedCode = 'EXISTING_CODE';
        $existingAffiliate = m::mock(AffiliateDomainObject::class);

        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with([
                'event_id' => $eventId,
                'code' => $expectedCode,
            ])
            ->andReturn($existingAffiliate);

        $this->affiliateRepository
            ->shouldNotReceive('create');

        $this->expectException(ResourceConflictException::class);
        $this->expectExceptionMessage('An affiliate with this code already exists for this event');

        $this->handler->handle($eventId, $accountId, $dto);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}