<?php

namespace Tests\Unit\Services\Application\Handlers\Organizer\Order;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\DTO\QueryParamsDTO;
use HiEvents\Repository\Eloquent\Value\Relationship;
use HiEvents\Repository\Interfaces\OrderRepositoryInterface;
use HiEvents\Services\Application\Handlers\Organizer\Order\GetOrganizerOrdersHandler;
use Illuminate\Pagination\LengthAwarePaginator;
use Mockery as m;
use Tests\TestCase;

class GetOrganizerOrdersHandlerTest extends TestCase
{
    public function testLoadsTheEventOfEachOrder(): void
    {
        $orderRepository = m::mock(OrderRepositoryInterface::class);
        $loadedEvent = false;

        $orderRepository->shouldReceive('loadRelation')->andReturnUsing(
            function ($relation) use ($orderRepository, &$loadedEvent) {
                if ($relation instanceof Relationship
                    && $relation->getDomainObject() === EventDomainObject::class
                    && $relation->getName() === 'event') {
                    $loadedEvent = true;
                }
                return $orderRepository;
            }
        );

        $params = QueryParamsDTO::fromArray(['per_page' => 10]);
        $paginator = new LengthAwarePaginator([], 0, 10);

        $orderRepository->shouldReceive('findByOrganizerId')
            ->once()
            ->with(5, 2, $params)
            ->andReturn($paginator);

        $result = (new GetOrganizerOrdersHandler($orderRepository))->handle(5, 2, $params);

        $this->assertSame($paginator, $result);
        $this->assertTrue($loadedEvent);
    }
}
