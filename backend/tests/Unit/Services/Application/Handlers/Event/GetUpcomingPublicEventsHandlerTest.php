<?php

namespace Tests\Unit\Services\Application\Handlers\Event;

use HiEvents\DomainObjects\Status\EventStatus;
use HiEvents\Http\DTO\QueryParamsDTO;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Services\Application\Handlers\Event\GetUpcomingPublicEventsHandler;
use Illuminate\Pagination\LengthAwarePaginator;
use Mockery as m;
use Tests\TestCase;

class GetUpcomingPublicEventsHandlerTest extends TestCase
{
    public function testHandleReturnsTheNextLiveEventsSoonestFirst(): void
    {
        $repository = m::mock(EventRepositoryInterface::class);
        $events = new LengthAwarePaginator([], 0, GetUpcomingPublicEventsHandler::LIMIT);

        $repository->shouldReceive('loadRelation')->times(4)->andReturnSelf();
        $repository->shouldReceive('findEvents')
            ->once()
            ->withArgs(function (array $where, QueryParamsDTO $params) {
                return $where['status'] === EventStatus::LIVE->name
                    && is_callable($where[0])
                    && $params->per_page === GetUpcomingPublicEventsHandler::LIMIT
                    && $params->sort_by === 'start_date'
                    && $params->sort_direction === 'asc'
                    && $params->query_params->get('eventsStatus') === 'upcoming';
            })
            ->andReturn($events);

        $this->assertSame($events, (new GetUpcomingPublicEventsHandler($repository))->handle());
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }
}
