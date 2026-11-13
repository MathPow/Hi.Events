<?php

namespace Tests\Unit\Services\Domain\Event\RecurringEvent;

use Carbon\Carbon;
use HiEvents\DomainObjects\CheckInListDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\ProductCategoryDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\Exceptions\RecurringEventValidationException;
use HiEvents\Helper\DateHelper;
use HiEvents\Services\Domain\Event\RecurringEvent\DTO\EventOccurrenceDTO;
use HiEvents\Services\Domain\Event\RecurringEvent\RecurringEventDateService;
use Tests\TestCase;

class RecurringEventDateServiceTest extends TestCase
{
    private const TORONTO = 'America/Toronto';

    private RecurringEventDateService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new RecurringEventDateService();
    }

    public function testKeepsTheLocalStartTimeAcrossTheEndOfDaylightSavingTime(): void
    {
        // Tuesday 27 October 2026, 18:00 → 20:00 in Toronto (EDT, UTC-4)
        $event = $this->event(start: '2026-10-27 22:00:00', end: '2026-10-28 00:00:00');

        $occurrences = $this->service->buildOccurrences($event, ['2026-11-03'], $this->now());

        /** @var EventOccurrenceDTO $occurrence */
        $occurrence = $occurrences->first();
        $this->assertSame('2026-11-03', $occurrence->date);
        $this->assertSame('2026-11-03 18:00:00', $occurrence->startDate);
        $this->assertSame('2026-11-03 20:00:00', $occurrence->endDate);

        // After the change to EST (UTC-5), 18:00 is 23:00 UTC instead of 22:00
        $this->assertSame('2026-11-03 23:00:00', $this->toUtc($occurrence->startDate));
        $this->assertSame('2026-11-04 01:00:00', $this->toUtc($occurrence->endDate));
    }

    public function testOccurrencesAreSortedAndKeepTheEventLength(): void
    {
        // Friday 30 October 2026 18:00 → Sunday 1 November 12:00 in Toronto
        $event = $this->event(start: '2026-10-30 22:00:00', end: '2026-11-01 17:00:00');

        $occurrences = $this->service->buildOccurrences($event, ['2026-12-04', '2026-11-13'], $this->now());

        $this->assertSame(['2026-11-13', '2026-12-04'], $occurrences->pluck('date')->all());
        $this->assertSame('2026-11-13 18:00:00', $occurrences[0]->startDate);
        $this->assertSame('2026-11-15 12:00:00', $occurrences[0]->endDate);
        $this->assertSame('2026-12-06 12:00:00', $occurrences[1]->endDate);
    }

    public function testAnEventWithoutEndDateGivesOccurrencesWithoutEndDate(): void
    {
        $event = $this->event(start: '2026-10-27 22:00:00', end: null);

        $occurrence = $this->service->buildOccurrences($event, ['2026-11-10'], $this->now())->first();

        $this->assertSame('2026-11-10 18:00:00', $occurrence->startDate);
        $this->assertNull($occurrence->endDate);
    }

    public function testRejectsADateInThePast(): void
    {
        $event = $this->event(start: '2026-10-27 22:00:00', end: null);

        $this->expectException(RecurringEventValidationException::class);

        $this->service->buildOccurrences($event, ['2026-11-03'], Carbon::parse('2026-11-04 12:00:00', 'UTC'));
    }

    public function testRejectsADateThatIsNotAfterTheEvent(): void
    {
        $event = $this->event(start: '2026-11-20 23:00:00', end: null);

        $this->expectException(RecurringEventValidationException::class);

        $this->service->buildOccurrences($event, ['2026-11-13'], $this->now());
    }

    public function testRejectsTheEventsOwnDay(): void
    {
        $event = $this->event(start: '2026-11-20 23:00:00', end: null);

        $this->expectException(RecurringEventValidationException::class);

        $this->service->buildOccurrences($event, ['2026-11-20'], $this->now());
    }

    public function testRejectsMoreThanTheMaximumOfDates(): void
    {
        $event = $this->event(start: '2026-10-27 22:00:00', end: null);
        $dates = array_map(
            static fn(int $week) => Carbon::parse('2026-11-03')->addWeeks($week)->format('Y-m-d'),
            range(0, RecurringEventDateService::MAX_OCCURRENCES),
        );

        $this->expectException(RecurringEventValidationException::class);

        $this->service->buildOccurrences($event, $dates, $this->now());
    }

    public function testAcceptsExactlyTheMaximumOfDates(): void
    {
        $event = $this->event(start: '2026-10-27 22:00:00', end: null);
        $dates = array_map(
            static fn(int $week) => Carbon::parse('2026-11-03')->addWeeks($week)->format('Y-m-d'),
            range(1, RecurringEventDateService::MAX_OCCURRENCES),
        );

        $this->assertCount(
            RecurringEventDateService::MAX_OCCURRENCES,
            $this->service->buildOccurrences($event, $dates, $this->now()),
        );
    }

    public function testRejectsTheSameDateTwice(): void
    {
        $event = $this->event(start: '2026-10-27 22:00:00', end: null);

        $this->expectException(RecurringEventValidationException::class);

        $this->service->buildOccurrences($event, ['2026-11-03', '2026-11-10', '2026-11-03'], $this->now());
    }

    public function testRejectsAnEmptyList(): void
    {
        $event = $this->event(start: '2026-10-27 22:00:00', end: null);

        $this->expectException(RecurringEventValidationException::class);

        $this->service->buildOccurrences($event, [], $this->now());
    }

    public function testRejectsADateThatDoesNotExist(): void
    {
        $event = $this->event(start: '2026-10-27 22:00:00', end: null);

        $this->expectException(RecurringEventValidationException::class);

        $this->service->buildOccurrences($event, ['2026-11-31'], $this->now());
    }

    public function testShiftsTheSalesPromoCodesAndCheckInListsByTheSameLocalDelta(): void
    {
        $event = $this->event(start: '2026-10-27 22:00:00', end: '2026-10-28 00:00:00');
        $price = (new ProductPriceDomainObject())
            ->setSaleStartDate('2026-10-20 13:00:00')
            ->setSaleEndDate(null);
        $product = (new ProductDomainObject())
            // Sales open Monday 19 October at 9:00 and close Tuesday 27 at 12:00, Toronto time
            ->setSaleStartDate('2026-10-19 13:00:00')
            ->setSaleEndDate('2026-10-27 16:00:00')
            ->setProductPrices(collect([$price]));
        $category = new ProductCategoryDomainObject();
        $category->setProducts(collect([$product]));
        $promoCode = (new PromoCodeDomainObject())->setExpiryDate('2026-10-26 03:59:00');
        $checkInList = (new CheckInListDomainObject())
            ->setActivatesAt('2026-10-27 21:00:00')
            ->setExpiresAt(null);
        $event
            ->setProductCategories(collect([$category]))
            ->setPromoCodes(collect([$promoCode]))
            ->setCheckInLists(collect([$checkInList]));

        $this->service->shiftRelatedDates($event, '2026-11-03 18:00:00');

        // One week later, same wall-clock times, now in EST
        $this->assertSame('2026-10-26 09:00:00', $product->getSaleStartDate());
        $this->assertSame('2026-11-03 12:00:00', $product->getSaleEndDate());
        $this->assertSame('2026-10-27 09:00:00', $price->getSaleStartDate());
        $this->assertNull($price->getSaleEndDate());
        $this->assertSame('2026-11-01 23:59:00', $promoCode->getExpiryDate());
        $this->assertSame('2026-11-03 17:00:00', $checkInList->getActivatesAt());
        $this->assertNull($checkInList->getExpiresAt());

        $this->assertSame('2026-11-03 17:00:00', $this->toUtc($product->getSaleEndDate()));
    }

    public function testShiftsNothingWhenTheEventHasNoRelatedDates(): void
    {
        $event = $this->event(start: '2026-10-27 22:00:00', end: null);

        $this->service->shiftRelatedDates($event, '2026-11-03 18:00:00');

        $this->assertNull($event->getProductCategories());
    }

    private function event(string $start, ?string $end): EventDomainObject
    {
        return (new EventDomainObject())
            ->setId(10)
            ->setTimezone(self::TORONTO)
            ->setStartDate($start)
            ->setEndDate($end);
    }

    private function now(): Carbon
    {
        return Carbon::parse('2026-10-01 12:00:00', 'UTC');
    }

    private function toUtc(string $wallClock): string
    {
        return Carbon::parse(DateHelper::convertToUTC($wallClock, self::TORONTO))->format('Y-m-d H:i:s');
    }
}
