<?php

namespace Tests\Unit\Services\Application\Handlers\Event;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\PromoCodeRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\DTO\GetPublicEventDTO;
use HiEvents\Services\Application\Handlers\Event\GetPublicEventHandler;
use HiEvents\Services\Domain\Event\EventPageViewIncrementService;
use HiEvents\Services\Domain\Product\ProductFilterService;
use Mockery as m;
use Tests\TestCase;

class GetPublicEventHandlerTest extends TestCase
{
    private EventRepositoryInterface $eventRepository;
    private PromoCodeRepositoryInterface $promoCodeRepository;
    private ProductFilterService $ticketFilterService;
    private EventPageViewIncrementService $eventPageViewIncrementService;
    private GetPublicEventHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->eventRepository = m::mock(EventRepositoryInterface::class);
        $this->promoCodeRepository = m::mock(PromoCodeRepositoryInterface::class);
        $this->ticketFilterService = m::mock(ProductFilterService::class);
        $this->eventPageViewIncrementService = m::mock(EventPageViewIncrementService::class);

        $this->handler = new GetPublicEventHandler(
            $this->eventRepository,
            $this->promoCodeRepository,
            $this->ticketFilterService,
            $this->eventPageViewIncrementService
        );
    }

    public function testHandleWithoutPromoCodeAndUnauthenticatedUser(): void
    {
        $data = new GetPublicEventDTO(eventId: 1, isAuthenticated: false, ipAddress: '127.0.0.1', promoCode: null);
        $event = new EventDomainObject();
        $event->setProductCategories(collect());

        $this->setupEventRepositoryMock($event, $data->eventId);
        $this->promoCodeRepository->shouldReceive('findWhere')->once()->andReturn(collect());
        $this->ticketFilterService->shouldReceive('filter')->once()->with(m::any(), null)->andReturn(collect());
        $this->eventPageViewIncrementService->shouldReceive('increment')->once()->with($data->eventId, $data->ipAddress);

        $result = $this->handler->handle($data);

        $this->assertTrue($result->getPromoCodes()->isEmpty());
    }

    public function testHandleExposesOnlyValidPromoCodes(): void
    {
        $data = new GetPublicEventDTO(eventId: 1, isAuthenticated: false, ipAddress: '127.0.0.1', promoCode: null);
        $event = new EventDomainObject();
        $event->setProductCategories(collect());
        $expired = m::mock(PromoCodeDomainObject::class)->makePartial();
        $expired->shouldReceive('isValid')->andReturn(false);
        $active = m::mock(PromoCodeDomainObject::class)->makePartial();
        $active->shouldReceive('isValid')->andReturn(true);

        $this->setupEventRepositoryMock($event, $data->eventId);
        $this->promoCodeRepository->shouldReceive('findWhere')->once()->andReturn(collect([$expired, $active]));
        $this->ticketFilterService->shouldReceive('filter')->once()->with(m::any(), null)->andReturn(collect());
        $this->eventPageViewIncrementService->shouldReceive('increment')->once();

        $result = $this->handler->handle($data);

        $this->assertCount(1, $result->getPromoCodes());
        $this->assertSame($active, $result->getPromoCodes()->first());
    }

    public function testHandleWithInvalidPromoCode(): void
    {
        $data = new GetPublicEventDTO(eventId: 1, isAuthenticated: false, ipAddress: '127.0.0.1', promoCode: 'INVALID');
        $event = new EventDomainObject();
        $event->setProductCategories(collect());
        $promoCode = m::mock(PromoCodeDomainObject::class)->makePartial();
        $promoCode->shouldReceive('isValid')->andReturn(false);
        $promoCode->shouldReceive('getCode')->andReturn('invalid');

        $this->setupEventRepositoryMock($event, $data->eventId);
        $this->promoCodeRepository->shouldReceive('findWhere')->once()->andReturn(collect([$promoCode]));
        $this->ticketFilterService->shouldReceive('filter')->once()->with(m::any(), null)->andReturn(collect());
        $this->eventPageViewIncrementService->shouldReceive('increment')->once()->with($data->eventId, $data->ipAddress);

        $this->handler->handle($data);
    }

    public function testHandleWithValidPromoCode(): void
    {
        $data = new GetPublicEventDTO(eventId: 1, isAuthenticated: false, ipAddress: '127.0.0.1', promoCode: 'VALID');
        $event = new EventDomainObject();
        $event->setProductCategories(collect());
        $promoCode = m::mock(PromoCodeDomainObject::class)->makePartial();
        $promoCode->shouldReceive('isValid')->andReturn(true);
        $promoCode->shouldReceive('getCode')->andReturn('VALID');

        $this->setupEventRepositoryMock($event, $data->eventId);
        $this->promoCodeRepository->shouldReceive('findWhere')->once()->andReturn(collect([$promoCode]));
        $this->ticketFilterService->shouldReceive('filter')->once()->with(m::any(), $promoCode)->andReturn(collect());
        $this->eventPageViewIncrementService->shouldReceive('increment')->once()->with($data->eventId, $data->ipAddress);

        $this->handler->handle($data);
    }

    private function setupEventRepositoryMock($event, $eventId): void
    {
        $this->eventRepository->shouldReceive('loadRelation')->andReturnSelf()->times(4);
        $this->eventRepository->shouldReceive('findById')->with($eventId)->andReturn($event);
    }
}
