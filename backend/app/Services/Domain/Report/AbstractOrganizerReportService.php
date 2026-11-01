<?php

namespace HiEvents\Services\Domain\Report;

use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use Illuminate\Cache\Repository;
use Illuminate\Database\DatabaseManager;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

abstract class AbstractOrganizerReportService
{
    private const CACHE_TTL_SECONDS = 30;

    // One event of the organizer, or all of them (buildEventFilter).
    protected ?int $eventId = null;

    public function __construct(
        private readonly Repository                    $cache,
        private readonly DatabaseManager               $queryBuilder,
        private readonly OrganizerRepositoryInterface  $organizerRepository,
    )
    {
    }

    public function generateReport(
        int     $organizerId,
        ?string $currency = null,
        ?Carbon $startDate = null,
        ?Carbon $endDate = null,
        ?int    $eventId = null,
    ): Collection
    {
        $this->eventId = $eventId;
        $organizer = $this->organizerRepository->findById($organizerId);
        $timezone = $organizer->getTimezone();

        $endDate = $endDate
            ? $endDate->copy()->setTimezone($timezone)->endOfDay()
            : now($timezone)->endOfDay();
        $startDate = $startDate
            ? $startDate->copy()->setTimezone($timezone)->startOfDay()
            : $endDate->copy()->subDays(30)->startOfDay();

        $reportResults = $this->cache->remember(
            key: $this->getCacheKey($organizerId, $currency, $startDate, $endDate) . ".$eventId",
            ttl: Carbon::now()->addSeconds(self::CACHE_TTL_SECONDS),
            callback: fn() => $this->queryBuilder->select(
                $this->getSqlQuery($startDate, $endDate, $currency),
                [
                    'organizer_id' => $organizerId,
                ]
            )
        );

        return collect($reportResults);
    }

    abstract protected function getSqlQuery(Carbon $startDate, Carbon $endDate, ?string $currency = null): string;

    protected function buildCurrencyFilter(string $column, ?string $currency): string
    {
        if ($currency === null) {
            return '';
        }
        $escapedCurrency = addslashes($currency);
        return "AND $column = '$escapedCurrency'";
    }

    /**
     * Narrows a report to the chosen event; the id is an integer, safe in the SQL.
     */
    protected function buildEventFilter(string $column): string
    {
        return $this->eventId === null ? '' : "AND $column = " . (int)$this->eventId;
    }

    protected function getCacheKey(int $organizerId, ?string $currency, ?Carbon $startDate, ?Carbon $endDate): string
    {
        return static::class . "$organizerId.$currency.{$startDate?->toDateString()}.{$endDate?->toDateString()}";
    }
}
