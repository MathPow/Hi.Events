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
        );
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

    public function getAchievementMetrics(int $organizerId, string $currencyCode): OrganizerAchievementMetricsDTO
    {
        // Orders the organizer created by hand don't count as a first sale, and
        // only events that ended with participants count toward a season.
        $query = <<<SQL
        WITH organizer_events AS (
            SELECT e.id, e.status, e.currency, COALESCE(e.end_date, e.start_date) AS ends_at
            FROM events e
            WHERE e.organizer_id = :organizerId
              AND e.deleted_at IS NULL
        ),
        active_attendees AS (
            SELECT a.event_id, LOWER(a.email) AS email
            FROM attendees a
            JOIN organizer_events oe ON oe.id = a.event_id
            WHERE a.status = 'ACTIVE'
              AND a.deleted_at IS NULL
        )
        SELECT
            (SELECT COUNT(*) FROM organizer_events) AS events_created,
            (SELECT COUNT(*) FROM organizer_events WHERE status = 'LIVE') AS live_events,
            (SELECT COUNT(DISTINCT i.type) FROM images i
                WHERE i.entity_type = :organizerEntityType
                  AND i.entity_id = :organizerId
                  AND i.type IN ('ORGANIZER_LOGO', 'ORGANIZER_COVER')
                  AND i.deleted_at IS NULL) AS organizer_page_images,
            (
                EXISTS (SELECT 1 FROM organizer_stripe_platforms osp
                    WHERE osp.organizer_id = :organizerId
                      AND osp.stripe_account_id IS NOT NULL
                      AND osp.stripe_setup_completed_at IS NOT NULL
                      AND osp.deleted_at IS NULL)
                OR EXISTS (SELECT 1 FROM account_stripe_platforms asp
                    JOIN organizers o ON o.account_id = asp.account_id
                    WHERE o.id = :organizerId
                      AND asp.stripe_account_id IS NOT NULL
                      AND asp.stripe_setup_completed_at IS NOT NULL
                      AND asp.deleted_at IS NULL)
            ) AS payments_connected,
            EXISTS (SELECT 1 FROM orders o
                JOIN organizer_events oe ON oe.id = o.event_id
                WHERE o.status = 'COMPLETED'
                  AND o.is_manually_created = FALSE
                  AND o.deleted_at IS NULL) AS has_participant_order,
            EXISTS (SELECT 1 FROM attendee_check_ins c
                JOIN organizer_events oe ON oe.id = c.event_id
                WHERE c.deleted_at IS NULL) AS has_check_in,
            (SELECT COUNT(*) FROM active_attendees) AS active_attendees,
            (SELECT COUNT(*) FROM (
                SELECT email FROM active_attendees
                WHERE email IS NOT NULL AND email <> ''
                GROUP BY email
                HAVING COUNT(DISTINCT event_id) >= 2
            ) regulars) AS regular_attendees,
            (SELECT COALESCE(SUM(es.sales_total_gross - COALESCE(es.total_refunded, 0)), 0)
                FROM event_statistics es
                JOIN organizer_events oe ON oe.id = es.event_id
                WHERE oe.currency = :currencyCode
                  AND es.deleted_at IS NULL) AS net_sales,
            (SELECT COUNT(*) FROM organizer_events oe
                WHERE oe.ends_at < NOW()
                  AND EXISTS (SELECT 1 FROM active_attendees aa WHERE aa.event_id = oe.id)) AS events_held
    SQL;

        $result = $this->db->selectOne($query, [
            'organizerId' => $organizerId,
            'organizerEntityType' => OrganizerDomainObject::class,
            'currencyCode' => $currencyCode,
        ]);

        return new OrganizerAchievementMetricsDTO(
            events_created: (int)$result->events_created,
            organizer_page_images: (int)$result->organizer_page_images,
            payments_connected: (bool)$result->payments_connected,
            live_events: (int)$result->live_events,
            has_participant_order: (bool)$result->has_participant_order,
            has_check_in: (bool)$result->has_check_in,
            active_attendees: (int)$result->active_attendees,
            regular_attendees: (int)$result->regular_attendees,
            net_sales: (float)$result->net_sales,
            events_held: (int)$result->events_held,
        );
    }
}
