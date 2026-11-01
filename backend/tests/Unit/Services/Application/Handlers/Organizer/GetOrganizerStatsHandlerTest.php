<?php

namespace Tests\Unit\Services\Application\Handlers\Organizer;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Repository\DTO\Organizer\OrganizerStatsResponseDTO;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use HiEvents\Services\Application\Handlers\Organizer\DTO\GetOrganizerStatsRequestDTO;
use HiEvents\Services\Application\Handlers\Organizer\GetOrganizerStatsHandler;
use Mockery as m;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Tests\TestCase;

class GetOrganizerStatsHandlerTest extends TestCase
{
    private OrganizerRepositoryInterface $organizerRepository;
    private GetOrganizerStatsHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->organizerRepository = m::mock(OrganizerRepositoryInterface::class);
        $this->handler = new GetOrganizerStatsHandler($this->organizerRepository);
    }

    public function testPassesThePeriodToTheRepository(): void
    {
        $this->givenOrganizer('CAD');
        $stats = $this->stats(periodDays: 30);

        $this->organizerRepository
            ->shouldReceive('getOrganizerStats')
            ->once()
            ->with(7, 3, 'CAD', 30)
            ->andReturn($stats);

        $result = $this->handler->handle(new GetOrganizerStatsRequestDTO(
            organizerId: 7,
            accountId: 3,
            periodDays: 30,
        ));

        $this->assertSame($stats, $result);
    }

    public function testAllTimeTotalsWithoutAPeriod(): void
    {
        $this->givenOrganizer('CAD');

        $this->organizerRepository
            ->shouldReceive('getOrganizerStats')
            ->once()
            ->with(7, 3, 'USD', null)
            ->andReturn($this->stats(periodDays: null));

        $result = $this->handler->handle(new GetOrganizerStatsRequestDTO(
            organizerId: 7,
            accountId: 3,
            currencyCode: 'USD',
        ));

        $this->assertNull($result->period_days);
        $this->assertNull($result->previous_total_gross_sales);
    }

    public function testThrowsWhenTheOrganizerIsNotInTheAccount(): void
    {
        $this->organizerRepository
            ->shouldReceive('findFirstWhere')
            ->with(['id' => 7, 'account_id' => 3])
            ->andReturnNull();
        $this->organizerRepository->shouldNotReceive('getOrganizerStats');

        $this->expectException(ResourceNotFoundException::class);

        $this->handler->handle(new GetOrganizerStatsRequestDTO(organizerId: 7, accountId: 3, periodDays: 30));
    }

    private function givenOrganizer(string $currency): void
    {
        $this->organizerRepository
            ->shouldReceive('findFirstWhere')
            ->with(['id' => 7, 'account_id' => 3])
            ->andReturn((new OrganizerDomainObject())->setId(7)->setCurrency($currency));
    }

    private function stats(?int $periodDays): OrganizerStatsResponseDTO
    {
        return new OrganizerStatsResponseDTO(
            total_products_sold: 12,
            total_attendees_registered: 10,
            total_orders: 6,
            total_gross_sales: 420.0,
            total_fees: 0.0,
            total_tax: 54.6,
            total_views: 80,
            total_refunded: 0.0,
            currency_code: 'CAD',
            period_days: $periodDays,
            previous_total_gross_sales: $periodDays === null ? null : 300.0,
        );
    }
}
