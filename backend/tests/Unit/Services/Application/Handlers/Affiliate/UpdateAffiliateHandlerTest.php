<?php

namespace Tests\Unit\Services\Application\Handlers\Affiliate;

use HiEvents\DomainObjects\AffiliateDomainObject;
use HiEvents\DomainObjects\Status\AffiliateStatus;
use HiEvents\Repository\Interfaces\AffiliateRepositoryInterface;
use HiEvents\Services\Domain\Affiliate\AffiliatePromoCodeValidationService;
use HiEvents\Services\Application\Handlers\Affiliate\UpdateAffiliateHandler;
use HiEvents\Services\Application\Handlers\Affiliate\DTO\UpsertAffiliateDTO;
use Mockery as m;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class UpdateAffiliateHandlerTest extends TestCase
{
    private AffiliateRepositoryInterface $affiliateRepository;
    private UpdateAffiliateHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->affiliateRepository = m::mock(AffiliateRepositoryInterface::class);
        $promoCodeValidationService = m::mock(AffiliatePromoCodeValidationService::class);
        $promoCodeValidationService->shouldReceive('assertPromoCodeBelongsToEvent')->byDefault();
        $this->handler = new UpdateAffiliateHandler($this->affiliateRepository, $promoCodeValidationService);
    }

    public function testHandleSuccessfullyUpdatesAffiliate(): void
    {
        $affiliateId = 1;
        $eventId = 2;
        $dto = new UpsertAffiliateDTO(
            name: 'Updated Affiliate',
            code: 'updated123',
            email: 'updated@example.com',
            status: AffiliateStatus::ACTIVE
        );

        $existingAffiliate = m::mock(AffiliateDomainObject::class);
        $updatedAffiliate = m::mock(AffiliateDomainObject::class);

        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with([
                'id' => $affiliateId,
                'event_id' => $eventId
            ])
            ->andReturn($existingAffiliate);

        $this->affiliateRepository
            ->shouldReceive('updateFromArray')
            ->once()
            ->with($affiliateId, [
                'name' => 'Updated Affiliate',
                'email' => 'updated@example.com',
                'status' => AffiliateStatus::ACTIVE->value,
                'promo_code_id' => null,
            ])
            ->andReturn($updatedAffiliate);

        $result = $this->handler->handle($affiliateId, $eventId, $dto);

        $this->assertSame($updatedAffiliate, $result);
    }

    public function testHandleSuccessfullyUpdatesAffiliateWithNullEmail(): void
    {
        $affiliateId = 1;
        $eventId = 2;
        $dto = new UpsertAffiliateDTO(
            name: 'Updated Affiliate',
            code: 'updated123',
            email: null,
            status: AffiliateStatus::INACTIVE
        );

        $existingAffiliate = m::mock(AffiliateDomainObject::class);
        $updatedAffiliate = m::mock(AffiliateDomainObject::class);

        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with([
                'id' => $affiliateId,
                'event_id' => $eventId
            ])
            ->andReturn($existingAffiliate);

        $this->affiliateRepository
            ->shouldReceive('updateFromArray')
            ->once()
            ->with($affiliateId, [
                'name' => 'Updated Affiliate',
                'status' => AffiliateStatus::INACTIVE->value,
                'promo_code_id' => null,
            ])
            ->andReturn($updatedAffiliate);

        $result = $this->handler->handle($affiliateId, $eventId, $dto);

        $this->assertSame($updatedAffiliate, $result);
    }

    public function testHandleFiltersOutNullValues(): void
    {
        $affiliateId = 1;
        $eventId = 2;
        $dto = new UpsertAffiliateDTO(
            name: 'Updated Affiliate',
            code: 'updated123',
            email: null,
            status: AffiliateStatus::ACTIVE
        );

        $existingAffiliate = m::mock(AffiliateDomainObject::class);
        $updatedAffiliate = m::mock(AffiliateDomainObject::class);

        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with([
                'id' => $affiliateId,
                'event_id' => $eventId
            ])
            ->andReturn($existingAffiliate);

        $this->affiliateRepository
            ->shouldReceive('updateFromArray')
            ->once()
            ->with($affiliateId, [
                'name' => 'Updated Affiliate',
                'status' => AffiliateStatus::ACTIVE->value,
                'promo_code_id' => null,
            ])
            ->andReturn($updatedAffiliate);

        $result = $this->handler->handle($affiliateId, $eventId, $dto);

        $this->assertSame($updatedAffiliate, $result);
    }

    public function testHandleThrowsExceptionWhenAffiliateNotFound(): void
    {
        $affiliateId = 1;
        $eventId = 2;
        $dto = new UpsertAffiliateDTO(
            name: 'Updated Affiliate',
            code: 'updated123',
            email: 'updated@example.com',
            status: AffiliateStatus::ACTIVE
        );

        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with([
                'id' => $affiliateId,
                'event_id' => $eventId
            ])
            ->andReturn(null);

        $this->affiliateRepository
            ->shouldNotReceive('updateFromArray');

        $this->expectException(NotFoundHttpException::class);
        $this->expectExceptionMessage('Affiliate not found');

        $this->handler->handle($affiliateId, $eventId, $dto);
    }

    public function testHandleChecksCorrectEventId(): void
    {
        $affiliateId = 1;
        $eventId = 2;
        $dto = new UpsertAffiliateDTO(
            name: 'Updated Affiliate',
            code: 'updated123',
            email: 'updated@example.com',
            status: AffiliateStatus::ACTIVE
        );

        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with([
                'id' => $affiliateId,
                'event_id' => $eventId
            ])
            ->andReturn(null);

        $this->expectException(NotFoundHttpException::class);
        $this->expectExceptionMessage('Affiliate not found');

        $this->handler->handle($affiliateId, $eventId, $dto);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}