<?php

declare(strict_types=1);

namespace HiEvents\Repository\Eloquent;

use Carbon\Carbon;
use HiEvents\DomainObjects\Generated\OrganizerDomainObjectAbstract;
use HiEvents\DomainObjects\Generated\OrganizerSettingDomainObjectAbstract;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\OrganizerStatus;
use HiEvents\Models\Organizer;
use HiEvents\Repository\DTO\Organizer\OrganizerAchievementMetricsDTO;
use HiEvents\Repository\DTO\Organizer\OrganizerStatsResponseDTO;
use HiEvents\Repository\Interfaces\OrganizerRepositoryInterface;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * @extends BaseRepository<OrganizerDomainObject>
 */
class OrganizerRepository extends BaseRepository implements OrganizerRepositoryInterface
{
    private const ALL_TIME_COMPARISON_DAYS = 30;

    protected function getModel(): string
    {
        return Organizer::class;
    }

    public function getDomainObject(): string
    {
        return OrganizerDomainObject::class;
    }

    public function getSitemapOrganizers(int $page, int $perPage): LengthAwarePaginator
    {
        return $this->handleResults($this->model
            ->select([
                'organizers.' . OrganizerDomainObjectAbstract::ID,
                'organizers.' . OrganizerDomainObjectAbstract::NAME,
                'organizers.' . OrganizerDomainObjectAbstract::UPDATED_AT,
            ])
            ->join('organizer_settings', 'organizers.id', '=', 'organizer_settings.organizer_id')
            ->where('organizers.' . OrganizerDomainObjectAbstract::STATUS, OrganizerStatus::LIVE->name)
            ->where('organizer_settings.' . OrganizerSettingDomainObjectAbstract::ALLOW_SEARCH_ENGINE_INDEXING, true)
            ->whereNull('organizers.' . OrganizerDomainObjectAbstract::DELETED_AT)
            ->orderBy('organizers.' . OrganizerDomainObjectAbstract::ID)
            ->paginate($perPage, ['*'], 'page', $page));
    }

    public function getSitemapOrganizerCount(): int
    {
        return $this->model
            ->newQuery()
            ->join('organizer_settings', 'organizers.id', '=', 'organizer_settings.organizer_id')
            ->where('organizers.' . OrganizerDomainObjectAbstract::STATUS, OrganizerStatus::LIVE->name)
            ->where('organizer_settings.' . OrganizerSettingDomainObjectAbstract::ALLOW_SEARCH_ENGINE_INDEXING, true)
            ->whereNull('organizers.' . OrganizerDomainObjectAbstract::DELETED_AT)
            ->count();
    }

    public function getOrganizerStats(
        int    $organizerId,
        int    $accountId,
        string $currencyCode,
        ?int   $periodDays = null,
    ): OrganizerStatsResponseDTO
    {
        if ($periodDays !== null) {
            return $this->getOrganizerStatsForPeriod($organizerId, $accountId, $currencyCode, $periodDays);
        }

        $totalsQuery = <<<SQL
        SELECT
            SUM(es.products_sold) AS total_products_sold,
            SUM(es.orders_created) AS total_orders,
            SUM(es.sales_total_gross) AS total_gross_sales,
            SUM(es.total_tax) AS total_tax,
            SUM(es.total_fee) AS total_fees,
            SUM(es.total_views) AS total_views,
            SUM(es.total_refunded) AS total_refunded,
            SUM(es.attendees_registered) AS attendees_registered
        FROM event_statistics es
        JOIN events e ON e.id = es.event_id
        WHERE e.organizer_id = :organizerId
          AND e.account_id = :accountId
          AND e.currency = :currencyCode
          AND es.deleted_at IS NULL;
    SQL;

        $totalsResult = $this->db->selectOne($totalsQuery, [
            'organizerId' => $organizerId,
            'accountId' => $accountId,
            'currencyCode' => $currencyCode,
        ]);

        $today = Carbon::today();
        $lastDays = $this->sumDailyStatistics(
            $organizerId,
            $accountId,
            $currencyCode,
            $today->copy()->subDays(self::ALL_TIME_COMPARISON_DAYS - 1),
            $today,
        );
        $before = static fn($total, $recent): float => max(0, (float)($total ?? 0) - (float)($recent ?? 0));

        return new OrganizerStatsResponseDTO(
            total_products_sold: (int)($totalsResult->total_products_sold ?? 0),
            total_attendees_registered: (int)($totalsResult->attendees_registered ?? 0),
            total_orders: (int)($totalsResult->total_orders ?? 0),
            total_gross_sales: (float)($totalsResult->total_gross_sales ?? 0),
            total_fees: (float)($totalsResult->total_fees ?? 0),
            total_tax: (float)($totalsResult->total_tax ?? 0),
            total_views: (int)($totalsResult->total_views ?? 0),
            total_refunded: (float)($totalsResult->total_refunded ?? 0),
            currency_code: $currencyCode,
            all_organizers_currencies: $this->getOrganizerCurrencies($organizerId, $accountId),
            previous_total_products_sold: (int)$before($totalsResult->total_products_sold, $lastDays->products_sold),
            previous_total_attendees_registered: (int)$before($totalsResult->attendees_registered, $lastDays->attendees_registered),
            previous_total_orders: (int)$before($totalsResult->total_orders, $lastDays->orders_created),
            previous_total_gross_sales: (float)$before($totalsResult->total_gross_sales, $lastDays->sales_total_gross),
            previous_total_tax: (float)$before($totalsResult->total_tax, $lastDays->total_tax),
            tax_names: $this->getAppliedTaxNames($organizerId, $accountId),
            comparison_days: self::ALL_TIME_COMPARISON_DAYS,
        );
    }

    private function sumDailyStatistics(
        int    $organizerId,
        int    $accountId,
        string $currencyCode,
        Carbon $from,
        Carbon $to,
    ): object
    {
        $query = <<<SQL
        SELECT
            COALESCE(SUM(eds.products_sold), 0) AS products_sold,
            COALESCE(SUM(eds.attendees_registered), 0) AS attendees_registered,
            COALESCE(SUM(eds.orders_created), 0) AS orders_created,
            COALESCE(SUM(eds.sales_total_gross), 0) AS sales_total_gross,
            COALESCE(SUM(eds.total_tax), 0) AS total_tax
        FROM event_daily_statistics eds
        JOIN events e ON e.id = eds.event_id
        WHERE e.organizer_id = :organizerId
          AND e.account_id = :accountId
          AND e.currency = :currencyCode
          AND eds.deleted_at IS NULL
          AND eds.date >= :from
          AND eds.date <= :to;
    SQL;

        return $this->db->selectOne($query, [
            'organizerId' => $organizerId,
            'accountId' => $accountId,
            'currencyCode' => $currencyCode,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
        ]);
    }

    private function getOrganizerStatsForPeriod(
        int    $organizerId,
        int    $accountId,
        string $currencyCode,
        int    $periodDays,
    ): OrganizerStatsResponseDTO
    {
        $today = Carbon::today();
        $currentStart = $today->copy()->subDays($periodDays - 1);
        $previousStart = $currentStart->copy()->subDays($periodDays);

        $query = <<<SQL
        SELECT
            SUM(CASE WHEN eds.date >= :currentStart THEN eds.products_sold ELSE 0 END) AS products_sold,
            SUM(CASE WHEN eds.date >= :currentStart THEN eds.attendees_registered ELSE 0 END) AS attendees_registered,
            SUM(CASE WHEN eds.date >= :currentStart THEN eds.orders_created ELSE 0 END) AS orders_created,
            SUM(CASE WHEN eds.date >= :currentStart THEN eds.sales_total_gross ELSE 0 END) AS sales_total_gross,
            SUM(CASE WHEN eds.date >= :currentStart THEN eds.total_tax ELSE 0 END) AS total_tax,
            SUM(CASE WHEN eds.date >= :currentStart THEN eds.total_fee ELSE 0 END) AS total_fee,
            SUM(CASE WHEN eds.date >= :currentStart THEN eds.total_views ELSE 0 END) AS total_views,
            SUM(CASE WHEN eds.date >= :currentStart THEN eds.total_refunded ELSE 0 END) AS total_refunded,
            SUM(CASE WHEN eds.date < :currentStart THEN eds.products_sold ELSE 0 END) AS previous_products_sold,
            SUM(CASE WHEN eds.date < :currentStart THEN eds.attendees_registered ELSE 0 END) AS previous_attendees_registered,
            SUM(CASE WHEN eds.date < :currentStart THEN eds.orders_created ELSE 0 END) AS previous_orders_created,
            SUM(CASE WHEN eds.date < :currentStart THEN eds.sales_total_gross ELSE 0 END) AS previous_sales_total_gross,
            SUM(CASE WHEN eds.date < :currentStart THEN eds.total_tax ELSE 0 END) AS previous_total_tax
        FROM event_daily_statistics eds
        JOIN events e ON e.id = eds.event_id
        WHERE e.organizer_id = :organizerId
          AND e.account_id = :accountId
          AND e.currency = :currencyCode
          AND eds.deleted_at IS NULL
          AND eds.date >= :previousStart
          AND eds.date <= :today;
    SQL;

        $result = $this->db->selectOne($query, [
            'organizerId' => $organizerId,
            'accountId' => $accountId,
            'currencyCode' => $currencyCode,
            'currentStart' => $currentStart->toDateString(),
            'previousStart' => $previousStart->toDateString(),
            'today' => $today->toDateString(),
        ]);

        return new OrganizerStatsResponseDTO(
            total_products_sold: (int)($result->products_sold ?? 0),
            total_attendees_registered: (int)($result->attendees_registered ?? 0),
            total_orders: (int)($result->orders_created ?? 0),
            total_gross_sales: (float)($result->sales_total_gross ?? 0),
            total_fees: (float)($result->total_fee ?? 0),
            total_tax: (float)($result->total_tax ?? 0),
            total_views: (int)($result->total_views ?? 0),
            total_refunded: (float)($result->total_refunded ?? 0),
            currency_code: $currencyCode,
            all_organizers_currencies: $this->getOrganizerCurrencies($organizerId, $accountId),
            period_days: $periodDays,
            previous_total_products_sold: (int)($result->previous_products_sold ?? 0),
            previous_total_attendees_registered: (int)($result->previous_attendees_registered ?? 0),
            previous_total_orders: (int)($result->previous_orders_created ?? 0),
            previous_total_gross_sales: (float)($result->previous_sales_total_gross ?? 0),
            previous_total_tax: (float)($result->previous_total_tax ?? 0),
            tax_names: $this->getAppliedTaxNames($organizerId, $accountId),
            comparison_days: $periodDays,
        );
    }

    private function getAppliedTaxNames(int $organizerId, int $accountId): array
    {
        $query = <<<SQL
        SELECT DISTINCT tf.name
        FROM taxes_and_fees tf
        JOIN product_taxes_and_fees ptf ON ptf.tax_and_fee_id = tf.id
        JOIN products p ON p.id = ptf.product_id
        JOIN events e ON e.id = p.event_id
        WHERE e.organizer_id = :organizerId
          AND e.account_id = :accountId
          AND tf.type = 'TAX'
          AND tf.deleted_at IS NULL
          AND p.deleted_at IS NULL
          AND e.deleted_at IS NULL
        ORDER BY tf.name;
SQL;

        return array_map(
            static fn($tax) => $tax->name,
            $this->db->select($query, [
                'organizerId' => $organizerId,
                'accountId' => $accountId,
            ])
        );
    }

    private function getOrganizerCurrencies(int $organizerId, int $accountId): array
    {
        $query = <<<SQL
        SELECT DISTINCT e.currency FROM events e
        WHERE e.organizer_id = :organizerId
          AND e.account_id = :accountId
          AND e.deleted_at IS NULL;
SQL;

        return array_map(
            static fn($currency) => $currency->currency,
            $this->db->select($query, [
                'organizerId' => $organizerId,
                'accountId' => $accountId,
            ])
        );
    }

    public function getAchievementMetrics(int $organizerId): OrganizerAchievementMetricsDTO
    {
        // Orders the organizer created by hand don't count as sales, and only events that
        // ended with participants count as held.
        $query = <<<SQL
        WITH organizer_events AS (
            SELECT e.id, COALESCE(e.end_date, e.start_date) AS ends_at
            FROM events e
            WHERE e.organizer_id = :organizerId
              AND e.deleted_at IS NULL
        ),
        active_attendees AS (
            SELECT a.event_id, LOWER(a.email) AS email, a.created_at
            FROM attendees a
            JOIN organizer_events oe ON oe.id = a.event_id
            WHERE a.status = 'ACTIVE'
              AND a.deleted_at IS NULL
        ),
        held_events AS (
            SELECT oe.id
            FROM organizer_events oe
            WHERE oe.ends_at < NOW()
              AND EXISTS (SELECT 1 FROM active_attendees aa WHERE aa.event_id = oe.id)
        ),
        participant_orders AS (
            SELECT o.id, o.promo_code_id
            FROM orders o
            JOIN organizer_events oe ON oe.id = o.event_id
            WHERE o.status = 'COMPLETED'
              AND o.is_manually_created = FALSE
              AND o.deleted_at IS NULL
        ),
        people AS (
            SELECT email, MIN(created_at) AS first_registered_here
            FROM active_attendees
            WHERE email IS NOT NULL AND email <> ''
            GROUP BY email
        )
        SELECT
            (SELECT COUNT(*) FROM organizer_events) AS events_created,
            EXISTS (SELECT 1 FROM order_items oi
                JOIN participant_orders po ON po.id = oi.order_id
                WHERE oi.product_type = 'GENERAL'
                  AND oi.deleted_at IS NULL) AS merchandise_sold,
            (SELECT COUNT(*) FROM active_attendees) AS active_attendees,
            (SELECT COUNT(*) FROM (
                SELECT email FROM active_attendees
                WHERE email IS NOT NULL AND email <> ''
                GROUP BY email
                HAVING COUNT(DISTINCT event_id) >= 2
            ) returners) AS returning_attendees,
            (SELECT COUNT(*) FROM held_events) AS events_held,
            (SELECT COUNT(*) FROM participant_orders WHERE promo_code_id IS NOT NULL) AS promo_code_orders,
            (SELECT COUNT(DISTINCT es.location_region) FROM event_settings es
                JOIN held_events he ON he.id = es.event_id
                WHERE es.location_region IS NOT NULL
                  AND es.is_online_event = FALSE
                  AND es.deleted_at IS NULL) AS regions_held,
            (SELECT COUNT(*) FROM people p
                WHERE NOT EXISTS (SELECT 1 FROM attendees earlier
                    JOIN events e ON e.id = earlier.event_id
                    WHERE LOWER(earlier.email) = p.email
                      AND e.organizer_id <> :organizerId
                      AND earlier.created_at < p.first_registered_here
                      AND earlier.deleted_at IS NULL)) AS first_time_attendees
    SQL;

        $result = $this->db->selectOne($query, ['organizerId' => $organizerId]);

        return new OrganizerAchievementMetricsDTO(
            events_created: (int)$result->events_created,
            merchandise_sold: (bool)$result->merchandise_sold,
            active_attendees: (int)$result->active_attendees,
            returning_attendees: (int)$result->returning_attendees,
            events_held: (int)$result->events_held,
            promo_code_orders: (int)$result->promo_code_orders,
            regions_held: (int)$result->regions_held,
            first_time_attendees: (int)$result->first_time_attendees,
        );
    }
}
