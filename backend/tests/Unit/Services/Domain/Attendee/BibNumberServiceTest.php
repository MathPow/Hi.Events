<?php

namespace Tests\Unit\Services\Domain\Attendee;

use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\Repository\Interfaces\AttendeeRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductPriceRepositoryInterface;
use HiEvents\Services\Domain\Attendee\BibNumberService;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Collection;
use Mockery as m;
use Tests\TestCase;

class BibNumberServiceTest extends TestCase
{
    private AttendeeRepositoryInterface $attendeeRepository;
    private ProductPriceRepositoryInterface $productPriceRepository;
    private DatabaseManager $databaseManager;
    private BibNumberService $service;
    private array $given = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->attendeeRepository = m::mock(AttendeeRepositoryInterface::class);
        $this->productPriceRepository = m::mock(ProductPriceRepositoryInterface::class);
        $this->databaseManager = m::mock(DatabaseManager::class);
        $this->databaseManager->shouldReceive('transaction')->andReturnUsing(fn($callback) => $callback());
        $this->databaseManager->shouldReceive('statement')
            ->with('SELECT pg_advisory_xact_lock(hashtext(?))', ['bib-numbers-7'])
            ->andReturn(true);

        $this->attendeeRepository->shouldReceive('updateWhere')
            ->andReturnUsing(function (array $attributes, array $where) {
                $this->given[$where['id']] = $attributes['bib_number'];
                return 1;
            });

        $this->service = new BibNumberService($this->attendeeRepository, $this->productPriceRepository, $this->databaseManager);
    }

    protected function tearDown(): void
    {
        m::close();
        parent::tearDown();
    }

    private function attendee(int $id, int $priceId, ?int $bib = null): AttendeeDomainObject
    {
        return (new AttendeeDomainObject())->setId($id)->setProductPriceId($priceId)->setBibNumber($bib);
    }

    private function givenWaiting(array $attendees, array $extraWhere = []): void
    {
        $this->attendeeRepository->shouldReceive('findWhere')
            ->once()
            ->with(['event_id' => 7, 'status' => 'ACTIVE', ['bib_number', 'null', null], ...$extraWhere])
            ->andReturn(new Collection($attendees));
    }

    private function givenNumbered(array $attendees): void
    {
        $this->attendeeRepository->shouldReceive('findWhere')
            ->once()
            ->with(['event_id' => 7, ['bib_number', 'not null', null]], ['id', 'product_price_id', 'bib_number'])
            ->andReturn(new Collection($attendees));
    }

    private function givenStarts(array $starts): void
    {
        $this->productPriceRepository->shouldReceive('findWhereIn')
            ->once()
            ->andReturn(new Collection(array_map(
                fn($id, $start) => (new ProductPriceDomainObject())->setId($id)->setBibNumberStart($start),
                array_keys($starts),
                $starts,
            )));
    }

    public function testEachDistanceCountsFromItsFirstNumberAfterTheLastGiven(): void
    {
        $this->givenWaiting([$this->attendee(2, 10), $this->attendee(1, 10), $this->attendee(3, 11), $this->attendee(4, 12)]);
        $this->givenStarts([10 => 100, 11 => 500, 12 => null]);
        $this->givenNumbered([$this->attendee(20, 10, 100), $this->attendee(21, 11, 501)]);

        $this->assertSame(3, $this->service->assignMissing(7));
        $this->assertSame([1 => 101, 2 => 102, 3 => 502], $this->given);
    }

    public function testNeverGivesANumberAlreadyTakenInTheEvent(): void
    {
        $this->givenWaiting([$this->attendee(1, 10)]);
        $this->givenStarts([10 => 1]);
        // The 5 km ended at 3, and a number set by hand took 4.
        $this->givenNumbered([$this->attendee(20, 10, 3), $this->attendee(21, 11, 4)]);

        $this->service->assignMissing(7);

        $this->assertSame([1 => 5], $this->given);
    }

    public function testAnOrderNumbersOnlyItsOwnAttendees(): void
    {
        $this->givenWaiting([$this->attendee(1, 10)], ['order_id' => 42]);
        $this->givenStarts([10 => 1]);
        $this->givenNumbered([]);

        $order = (new OrderDomainObject())->setId(42)->setEventId(7);

        $this->assertSame(1, $this->service->assignForOrder($order));
        $this->assertSame([1 => 1], $this->given);
    }

    public function testNothingToDoWithoutFirstNumbers(): void
    {
        $this->givenWaiting([$this->attendee(1, 10)]);
        $this->givenStarts([10 => null]);

        $this->assertSame(0, $this->service->assignMissing(7));
        $this->assertSame([], $this->given);
    }
}
