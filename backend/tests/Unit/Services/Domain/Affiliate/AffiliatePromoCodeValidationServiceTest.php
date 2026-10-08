<?php

namespace Tests\Unit\Services\Domain\Affiliate;

use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;
use HiEvents\Services\Domain\Affiliate\AffiliatePromoCodeValidationService;
use Mockery as m;
use Tests\TestCase;

class AffiliatePromoCodeValidationServiceTest extends TestCase
{
    private PromoCodeRepositoryInterface $promoCodeRepository;
    private AffiliatePromoCodeValidationService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->promoCodeRepository = m::mock(PromoCodeRepositoryInterface::class);
        $this->service = new AffiliatePromoCodeValidationService($this->promoCodeRepository);
    }

    public function testSkipsLookupWhenNoPromoCode(): void
    {
        $this->promoCodeRepository->shouldNotReceive('findFirstWhere');

        $this->service->assertPromoCodeBelongsToEvent(null, 10);

        $this->addToAssertionCount(1);
    }

    public function testPassesWhenPromoCodeBelongsToEvent(): void
    {
        $this->promoCodeRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with(['id' => 42, 'event_id' => 10])
            ->andReturn(new PromoCodeDomainObject());

        $this->service->assertPromoCodeBelongsToEvent(42, 10);

        $this->addToAssertionCount(1);
    }

    public function testThrowsWhenPromoCodeBelongsToAnotherEvent(): void
    {
        $this->promoCodeRepository->shouldReceive('findFirstWhere')->andReturn(null);

        $this->expectException(ResourceNotFoundException::class);

        $this->service->assertPromoCodeBelongsToEvent(42, 10);
    }
}
