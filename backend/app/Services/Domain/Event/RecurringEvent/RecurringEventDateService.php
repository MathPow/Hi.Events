<?php

namespace HiEvents\Services\Domain\Event\RecurringEvent;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use HiEvents\DomainObjects\CheckInListDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\ProductCategoryDomainObject;
use HiEvents\DomainObjects\ProductDomainObject;
use HiEvents\DomainObjects\ProductPriceDomainObject;
use HiEvents\DomainObjects\PromoCodeDomainObject;
use HiEvents\Exceptions\RecurringEventValidationException;
use HiEvents\Services\Domain\Event\RecurringEvent\DTO\EventOccurrenceDTO;
use Illuminate\Support\Collection;
use Throwable;

/**
 * The dates of an event repeated on other days. Every shift is done on wall-clock time in the
 * event's timezone, so an 18:00 run stays at 18:00 across a daylight saving change.
 */
class RecurringEventDateService
{
    public const MAX_OCCURRENCES = 26;

    private const WALL_CLOCK_FORMAT = 'Y-m-d H:i:s';

    /**
     * @param string[] $dates Calendar days (Y-m-d) in the event's timezone
     * @return Collection<int, EventOccurrenceDTO>
     * @throws RecurringEventValidationException
     */
    public function buildOccurrences(EventDomainObject $event, array $dates, ?CarbonInterface $now = null): Collection
    {
        if (count($dates) === 0) {
            throw new RecurringEventValidationException(__('Choose at least one date.'));
        }

        if (count($dates) > self::MAX_OCCURRENCES) {
            throw new RecurringEventValidationException(__('You can add at most :max dates at a time.', [
                'max' => self::MAX_OCCURRENCES,
            ]));
        }

        if (count(array_unique($dates)) !== count($dates)) {
            throw new RecurringEventValidationException(__('Each date can only be chosen once.'));
        }

        $timezone = $event->getTimezone();
        $sourceStart = Carbon::parse($event->getStartDate(), 'UTC');
        $sourceWallClockStart = $this->toWallClock($event->getStartDate(), $timezone);
        $now ??= Carbon::now();

        return collect($dates)
            ->sort()
            ->values()
            ->map(function (string $date) use ($event, $timezone, $sourceStart, $sourceWallClockStart, $now) {
                $start = $this->parseDay($date, $timezone)->setTimeFrom(Carbon::parse($sourceWallClockStart));

                if ($start->lessThanOrEqualTo($now)) {
                    throw new RecurringEventValidationException(__('The date :date is in the past.', [
                        'date' => $this->dayLabel($start),
                    ]));
                }

                if ($start->lessThanOrEqualTo($sourceStart)) {
                    throw new RecurringEventValidationException(__('The date :date must be after the event.', [
                        'date' => $this->dayLabel($start),
                    ]));
                }

                $startDate = $start->format(self::WALL_CLOCK_FORMAT);
                $shift = $this->wallClockShiftInSeconds($sourceWallClockStart, $startDate);

                return new EventOccurrenceDTO(
                    date: $date,
                    startDate: $startDate,
                    endDate: $this->shiftDate($event->getEndDate(), $timezone, $shift),
                );
            });
    }

    /**
     * Moves the sales dates, the promo codes' expiry and the check-in lists' window of a loaded
     * event by as much as its start moves to $newStartDate (wall clock, event's timezone). The
     * moved dates become wall-clock times in the event's timezone, ready for the create services.
     */
    public function shiftRelatedDates(EventDomainObject $event, string $newStartDate): void
    {
        $timezone = $event->getTimezone();
        $seconds = $this->wallClockShiftInSeconds($this->toWallClock($event->getStartDate(), $timezone), $newStartDate);
        $shift = fn(?string $date) => $this->shiftDate($date, $timezone, $seconds);

        $event->getProductCategories()?->each(function (ProductCategoryDomainObject $category) use ($shift) {
            $category->getProducts()?->each(function (ProductDomainObject $product) use ($shift) {
                $product
                    ->setSaleStartDate($shift($product->getSaleStartDate()))
                    ->setSaleEndDate($shift($product->getSaleEndDate()));

                $product->getProductPrices()?->each(fn(ProductPriceDomainObject $price) => $price
                    ->setSaleStartDate($shift($price->getSaleStartDate()))
                    ->setSaleEndDate($shift($price->getSaleEndDate())));
            });
        });

        $event->getPromoCodes()?->each(fn(PromoCodeDomainObject $promoCode) => $promoCode
            ->setExpiryDate($shift($promoCode->getExpiryDate())));

        $event->getCheckInLists()?->each(fn(CheckInListDomainObject $checkInList) => $checkInList
            ->setActivatesAt($shift($checkInList->getActivatesAt()))
            ->setExpiresAt($shift($checkInList->getExpiresAt())));
    }

    /**
     * A UTC date moved by $seconds of wall-clock time, as a wall-clock time in $timezone.
     */
    public function shiftDate(?string $utcDate, string $timezone, int $seconds): ?string
    {
        if (!$utcDate) {
            return null;
        }

        return Carbon::parse($this->toWallClock($utcDate, $timezone), 'UTC')
            ->addSeconds($seconds)
            ->format(self::WALL_CLOCK_FORMAT);
    }

    private function dayLabel(Carbon $day): string
    {
        return $day->copy()->locale(app()->getLocale())->isoFormat('LL');
    }

    private function toWallClock(string $utcDate, string $timezone): string
    {
        return Carbon::parse($utcDate, 'UTC')->setTimezone($timezone)->format(self::WALL_CLOCK_FORMAT);
    }

    private function wallClockShiftInSeconds(string $fromWallClock, string $toWallClock): int
    {
        return Carbon::parse($toWallClock, 'UTC')->getTimestamp() - Carbon::parse($fromWallClock, 'UTC')->getTimestamp();
    }

    /**
     * @throws RecurringEventValidationException
     */
    private function parseDay(string $date, string $timezone): Carbon
    {
        try {
            $day = Carbon::createFromFormat('!Y-m-d', $date, $timezone);
        } catch (Throwable) {
            $day = false;
        }

        if (!$day || $day->format('Y-m-d') !== $date) {
            throw new RecurringEventValidationException(__('The date :date is not valid.', ['date' => $date]));
        }

        return $day;
    }
}
