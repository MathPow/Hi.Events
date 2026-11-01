<?php

namespace HiEvents\Services\Domain\Report\OrganizerReports;

use HiEvents\DomainObjects\Enums\ProductType;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Services\Domain\Report\AbstractOrganizerReportService;
use Illuminate\Support\Carbon;

/**
 * The merch sold with the tickets (products that are not tickets), per
 * product and event, for completed orders placed in the period.
 */
class MerchSalesReport extends AbstractOrganizerReportService
{
    protected function getSqlQuery(Carbon $startDate, Carbon $endDate, ?string $currency = null): string
    {
        $completedStatus = OrderStatus::COMPLETED->name;
        $merchType = ProductType::GENERAL->name;
        $startDateStr = $startDate->toDateString();
        $endDateStr = $endDate->toDateString();
        $currencyFilter = $this->buildCurrencyFilter('o.currency', $currency);
        $eventFilter = $this->buildEventFilter('e.id');

        return <<<SQL
            SELECT
                e.id AS event_id,
                e.title AS event_name,
                e.currency AS event_currency,
                oi.product_id,
                -- Le produit, pas une de ses options (taille, couleur...).
                COALESCE(p.title, MAX(oi.item_name)) AS product_name,
                SUM(oi.quantity) AS quantity_sold,
                SUM(oi.total_gross) AS gross_sales,
                COUNT(DISTINCT o.id) AS order_count
            FROM order_items oi
            INNER JOIN orders o ON oi.order_id = o.id
            INNER JOIN events e ON o.event_id = e.id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE e.organizer_id = :organizer_id
                AND oi.product_type = '$merchType'
                AND o.status = '$completedStatus'
                AND o.deleted_at IS NULL
                AND oi.deleted_at IS NULL
                AND e.deleted_at IS NULL
                $currencyFilter
                $eventFilter
                AND DATE(o.created_at) BETWEEN '$startDateStr' AND '$endDateStr'
            GROUP BY e.id, e.title, e.currency, oi.product_id, p.title
            ORDER BY quantity_sold DESC, product_name
SQL;
    }
}
