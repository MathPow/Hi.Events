<?php

namespace Tests\Unit\Services\Domain\EventChange;

use Carbon\Carbon;
use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\Exceptions\EventChangeNotAllowedException;
use HiEvents\Repository\Interfaces\EventDateChangeRepositoryInterface;
use HiEvents\Repository\Interfaces\EventRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductPriceRepositoryInterface;
use HiEvents\Repository\Interfaces\ProductRepositoryInterface;
use HiEvents\Services\Application\Handlers\EventChange\DTO\PostponeEventDTO;
use HiEvents\Services\Domain\EventChange\EventPostponementService;
use Mockery;
use Tests\TestCase;

class EventPostponementServiceTest extends TestCase
{
    private EventRepositoryInterface $eventRepository;
    private ProductRepositoryInterface $productRepository;
    private ProductPriceRepositoryInterface $productPriceRepository;
    private EventDateChangeRepositoryInterface $eventDateChangeRepository;
    private EventPostponementService $service;

    /** @var array<int, string> product id => new sale end */
    private array $productUpdates = [];

    /** @var array<int, string> price id => new sale end */
    private array $priceUpdates = [];

    private ?array $created = null;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-12 12:00:00', 'UTC'));

        $this->eventRepository = Mockery::mock(EventRepositoryInterface::class);
        $this->productRepository = Mockery::mock(ProductRepositoryInterface::class);
        $this->productPriceRepository = Mockery::mock(ProductPriceRepositoryInterface::class);
        $this->eventDateChangeRepository = Mockery::mock(EventDateChangeRepositoryInterface::class);

        $this->productRepository->shouldReceive('findWhere')->andReturn(collect([
            // Sales open until the event: they follow it.
            (new ProductDomainObject())->setId(1)->setSaleEndDate('2026-11-14 14:00:00'),
            // Sales closed the day before: left alone.
            (new ProductDomainObject())->setId(2)->setSaleEndDate('2026-11-13 12:00:00'),
            (new ProductDomainObject())->setId(3)->setSaleEndDate(null),
        ]))->byDefault();
        $this->productRepository->shouldReceive('updateWhere')->andReturnUsing(function (array $attributes, array $where) {
            $this->productUpdates[$where['id']] = $attributes['sale_end_date'];
            return 1;
        });

        $this->productPriceRepository->shouldReceive('findWhereIn')->with('product_id', [1, 2, 3])->andReturn(collect([
            (new ProductPriceDomainObject())->setId(10)->setSaleEndDate('2026-11-14 15:00:00'),
            (new ProductPriceDomainObject())->setId(11)->setSaleEndDate('2026-11-01 15:00:00'),
        ]))->byDefault();
        $this->productPriceRepository->shouldReceive('updateWhere')->andReturnUsing(function (array $attributes, array $where) {
            $this->priceUpdates[$where['id']] = $attributes['sale_end_date'];
            return 1;
        });

        $this->eventDateChangeRepository->shouldReceive('create')->andReturnUsing(function (array $attributes) {
            $this->created = $attributes;
            return (new EventDateChangeDomainObject())->setId(7);
        });

        $this->service = new EventPostponementService(
            eventRepository: $this->eventRepository,
            productRepository: $this->productRepository,
            productPriceRepository: $this->productPriceRepository,
            eventDateChangeRepository: $this->eventDateChangeRepository,
        );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_it_moves_the_event_and_the_sales_that_were_open_until_it(): void
    {
        $this->eventRepository->shouldReceive('updateWhere')->once()->with(
            [
                'start_date' => '2026-11-21 14:00:00',
                'end_date' => '2026-11-21 17:00:00',
            ],
            ['id' => 5],
        )->andReturn(1);

        $this->service->postpone($this->event(), $this->dto());

        $this->assertSame([1 => '2026-11-21 14:00:00'], $this->productUpdates);
        $this->assertSame([10 => '2026-11-21 15:00:00'], $this->priceUpdates);
    }

    public function test_it_records_the_change_with_a_refund_deadline_48_hours_before_the_new_start(): void
    {
        $this->eventRepository->shouldReceive('updateWhere')->andReturn(1);

        $this->service->postpone($this->event(), $this->dto(message: "  Tempête de neige.\nOn se reprend.  "));

        $this->assertSame([
            'event_id' => 5,
            'user_id' => 9,
            'old_start_date' => '2026-11-14 14:00:00',
            'old_end_date' => '2026-11-14 17:00:00',
            'new_start_date' => '2026-11-21 14:00:00',
            'new_end_date' => '2026-11-21 17:00:00',
            'refunds_allowed' => true,
            'refund_deadline' => '2026-11-19 14:00:00',
            'message' => "Tempête de neige.\nOn se reprend.",
        ], $this->created);
    }

    public function test_the_deadline_falls_back_to_the_new_start_when_48_hours_before_is_already_past(): void
    {
        $this->eventRepository->shouldReceive('updateWhere')->andReturn(1);

        $this->service->postpone($this->event(), $this->dto(start: '2026-11-13 09:00', end: null));

        $this->assertSame('2026-11-13 14:00:00', $this->created['refund_deadline']);
        $this->assertNull($this->created['new_end_date']);
    }

    public function test_a_typed_deadline_is_kept_in_the_events_timezone(): void
    {
        $this->eventRepository->shouldReceive('updateWhere')->andReturn(1);

        $this->service->postpone($this->event(), $this->dto(deadline: '2026-11-20 18:00'));

        $this->assertSame('2026-11-20 23:00:00', $this->created['refund_deadline']);
    }

    public function test_no_deadline_without_refunds(): void
    {
        $this->eventRepository->shouldReceive('updateWhere')->andReturn(1);

        $this->service->postpone($this->event(), $this->dto(refunds: false, deadline: '2026-11-20 18:00'));

        $this->assertFalse($this->created['refunds_allowed']);
        $this->assertNull($this->created['refund_deadline']);
    }

    public function test_a_deadline_after_the_new_start_is_refused(): void
    {
        $this->eventRepository->shouldNotReceive('updateWhere');

        $this->expectException(EventChangeNotAllowedException::class);

        $this->service->postpone($this->event(), $this->dto(deadline: '2026-11-22 09:00'));
    }

    public function test_a_new_date_in_the_past_is_refused(): void
    {
        $this->eventRepository->shouldNotReceive('updateWhere');

        $this->expectException(EventChangeNotAllowedException::class);

        $this->service->postpone($this->event(), $this->dto(start: '2026-11-10 09:00', end: '2026-11-10 12:00'));
    }

    public function test_a_cancelled_event_cannot_be_postponed(): void
    {
        $this->eventRepository->shouldNotReceive('updateWhere');

        $this->expectException(EventChangeNotAllowedException::class);

        $this->service->postpone($this->event()->setCancelledAt('2026-11-11 10:00:00'), $this->dto());
    }

    private function event(): EventDomainObject
    {
        return (new EventDomainObject())
            ->setId(5)
            ->setTimezone('America/Toronto')
            ->setStartDate('2026-11-14 14:00:00')
            ->setEndDate('2026-11-14 17:00:00');
    }

    private function dto(
        string  $start = '2026-11-21 09:00',
        ?string $end = '2026-11-21 12:00',
        bool    $refunds = true,
        ?string $deadline = null,
        string  $message = 'Reporté.',
    ): PostponeEventDTO
    {
        return new PostponeEventDTO(
            eventId: 5,
            accountId: 1,
            userId: 9,
            startDate: $start,
            endDate: $end,
            message: $message,
            refundsAllowed: $refunds,
            refundDeadline: $deadline,
        );
    }
}
