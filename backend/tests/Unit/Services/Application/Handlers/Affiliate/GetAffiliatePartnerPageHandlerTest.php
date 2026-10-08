<?php

namespace Tests\Unit\Services\Application\Handlers\Affiliate;

use HiEvents\DomainObjects\AffiliateDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\Exceptions\AffiliateNotFoundException;
use HiEvents\Repository\DTO\AffiliateSalesSummaryDTO;
use HiEvents\Repository\Interfaces\AffiliateRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;
use HiEvents\Services\Application\Handlers\Affiliate\GetAffiliatePartnerPageHandler;
use Mockery as m;
use Tests\TestCase;

class GetAffiliatePartnerPageHandlerTest extends TestCase
{
    private AffiliateRepositoryInterface $affiliateRepository;
    private EventRepositoryInterface $eventRepository;
    private OrderRepositoryInterface $orderRepository;
    private PromoCodeRepositoryInterface $promoCodeRepository;
    private GetAffiliatePartnerPageHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->affiliateRepository = m::mock(AffiliateRepositoryInterface::class);
        $this->eventRepository = m::mock(EventRepositoryInterface::class);
        $this->orderRepository = m::mock(OrderRepositoryInterface::class);
        $this->promoCodeRepository = m::mock(PromoCodeRepositoryInterface::class);

        $this->handler = new GetAffiliatePartnerPageHandler(
            $this->affiliateRepository,
            $this->eventRepository,
            $this->orderRepository,
            $this->promoCodeRepository,
        );
    }

    private function makeAffiliate(?int $promoCodeId = null): AffiliateDomainObject
    {
        return (new AffiliateDomainObject())
            ->setId(5)
            ->setEventId(10)
            ->setAccountId(1)
            ->setName('Julie')
            ->setCode('JULIE')
            ->setStatus('ACTIVE')
            ->setPromoCodeId($promoCodeId)
            ->setPublicToken('secret-token');
    }

    public function testThrowsWhenTokenIsUnknown(): void
    {
        $this->affiliateRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with(['public_token' => 'nope'])
            ->andReturn(null);

        $this->expectException(AffiliateNotFoundException::class);

        $this->handler->handle('nope');
    }

    public function testReturnsSummaryWithoutPromoCode(): void
    {
        $this->affiliateRepository->shouldReceive('findFirstWhere')->andReturn($this->makeAffiliate());
        $this->eventRepository->shouldReceive('findById')->with(10)->andReturn((new EventDomainObject())->setCurrency('CAD'));
        $this->promoCodeRepository->shouldNotReceive('findFirstWhere');

        $this->orderRepository
            ->shouldReceive('getAffiliateSalesSummary')
            ->once()
            ->with(10, 5, null)
            ->andReturn(new AffiliateSalesSummaryDTO(ordersCount: 3, ticketsCount: 7, totalGross: 140.5));

        $result = $this->handler->handle('secret-token');

        $this->assertSame(10, $result->eventId);
        $this->assertSame('Julie', $result->name);
        $this->assertSame('JULIE', $result->code);
        $this->assertNull($result->promoCode);
        $this->assertSame('CAD', $result->currency);
        $this->assertSame(3, $result->ordersCount);
        $this->assertSame(7, $result->ticketsCount);
        $this->assertSame(140.5, $result->totalGross);
    }

    public function testIncludesLinkedPromoCodeInSummary(): void
    {
        $this->affiliateRepository->shouldReceive('findFirstWhere')->andReturn($this->makeAffiliate(promoCodeId: 42));
        $this->eventRepository->shouldReceive('findById')->andReturn((new EventDomainObject())->setCurrency('CAD'));

        $this->promoCodeRepository
            ->shouldReceive('findFirstWhere')
            ->once()
            ->with(['id' => 42, 'event_id' => 10])
            ->andReturn((new PromoCodeDomainObject())->setId(42)->setCode('julie10'));

        $this->orderRepository
            ->shouldReceive('getAffiliateSalesSummary')
            ->once()
            ->with(10, 5, 42)
            ->andReturn(new AffiliateSalesSummaryDTO(ordersCount: 0, ticketsCount: 0, totalGross: 0.0));

        $result = $this->handler->handle('secret-token');

        $this->assertSame('julie10', $result->promoCode);
    }

    public function testIgnoresPromoCodeFromAnotherEvent(): void
    {
        $this->affiliateRepository->shouldReceive('findFirstWhere')->andReturn($this->makeAffiliate(promoCodeId: 42));
        $this->eventRepository->shouldReceive('findById')->andReturn((new EventDomainObject())->setCurrency('CAD'));
        $this->promoCodeRepository->shouldReceive('findFirstWhere')->andReturn(null);

        $this->orderRepository
            ->shouldReceive('getAffiliateSalesSummary')
            ->once()
            ->with(10, 5, null)
            ->andReturn(new AffiliateSalesSummaryDTO(ordersCount: 0, ticketsCount: 0, totalGross: 0.0));

        $result = $this->handler->handle('secret-token');

        $this->assertNull($result->promoCode);
    }
}
