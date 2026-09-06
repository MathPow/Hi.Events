<?php

namespace HiEvents\Services\Application\Handlers\Admin;

use Carbon\Carbon;
use HiEvents\DomainObjects\Enums\PaymentProviders;
use HiEvents\DomainObjects\Status\OrderApplicationFeeStatus;
use HiEvents\DomainObjects\Status\OrderPaymentStatus;
use HiEvents\DomainObjects\Status\OrderRefundStatus;
use HiEvents\DomainObjects\Status\OrderStatus;
use HiEvents\Services\Application\Handlers\Admin\DTO\GetPlatformRevenueDTO;
use HiEvents\Services\Application\Handlers\Admin\DTO\PlatformRevenueResponseDTO;
use Illuminate\Contracts\Config\Repository as ConfigRepository;
use Illuminate\Support\Facades\DB;

/**
 * Ce que la plateforme gagne, separe en deux sources qui ne se recouvrent pas:
 * la commission prelevee sur les ventes et la contribution volontaire de
 * l'acheteur.
 *
 * order_application_fees.amount ne peut pas etre lu tel quel: sur Stripe il
 * vient de application_fee_amount, qui transporte la commission ET la
 * contribution (seul canal qui ramene de l'argent a la plateforme sur une
 * charge directe). La part contribution en est donc retiree, nette des frais de
 * traitement que la plateforme absorbe, pour ne garder que la commission.
 */
class GetPlatformRevenueHandler
{
    private const BUCKET_CURRENCY = 'currency';

    private const BUCKET_MONTH = 'month';

    public function __construct(
        private readonly ConfigRepository $config,
    )
    {
    }

    public function handle(GetPlatformRevenueDTO $dto): PlatformRevenueResponseDTO
    {
        $since = Carbon::now()->subDays($dto->days);
        $monthlySince = Carbon::now()->startOfMonth()->subMonths($dto->months - 1);

        $byCurrency = $this->buckets(self::BUCKET_CURRENCY);
        $recent = $this->buckets(self::BUCKET_CURRENCY, $since);
        $monthly = $this->buckets(self::BUCKET_MONTH, $monthlySince);

        $currencyRows = array_values($byCurrency);
        usort($currencyRows, static fn(array $a, array $b) => $b['total'] <=> $a['total']);

        $monthlyRows = array_values($monthly);
        usort($monthlyRows, static fn(array $a, array $b) => strcmp($a['bucket'], $b['bucket']));

        return new PlatformRevenueResponseDTO(
            days: $dto->days,
            contributions_total: $this->sum($byCurrency, 'contributions'),
            commissions_total: $this->sum($byCurrency, 'commissions'),
            total: $this->sum($byCurrency, 'total'),
            contributions_orders: (int)$this->sum($byCurrency, 'contributions_orders'),
            recent_contributions_total: $this->sum($recent, 'contributions'),
            recent_commissions_total: $this->sum($recent, 'commissions'),
            recent_total: $this->sum($recent, 'total'),
            recent_contributions_orders: (int)$this->sum($recent, 'contributions_orders'),
            by_currency: array_map(static fn(array $row) => [
                'currency' => $row['bucket'],
                'contributions' => $row['contributions'],
                'contributions_orders' => $row['contributions_orders'],
                'commissions' => $row['commissions'],
                'total' => $row['total'],
            ], $currencyRows),
            monthly: array_map(static fn(array $row) => [
                'month' => $row['bucket'],
                'contributions' => $row['contributions'],
                'contributions_orders' => $row['contributions_orders'],
                'commissions' => $row['commissions'],
                'total' => $row['total'],
            ], $monthlyRows),
        );
    }

    /**
     * @return array<string, array{bucket: string, contributions: float, contributions_orders: int, commissions: float, total: float}>
     */
    private function buckets(string $bucket, ?Carbon $since = null): array
    {
        $buckets = [];

        foreach ($this->getContributions($bucket, $since) as $row) {
            $key = (string)$row->bucket;

            $buckets[$key] = $this->emptyBucket($key);
            $buckets[$key]['contributions'] = round((float)$row->amount, 2);
            $buckets[$key]['contributions_orders'] = (int)$row->orders_count;
        }

        foreach ($this->getCommissions($bucket, $since) as $row) {
            $key = (string)$row->bucket;

            $buckets[$key] ??= $this->emptyBucket($key);
            $buckets[$key]['commissions'] = round((float)$row->amount, 2);
        }

        foreach ($buckets as $key => $values) {
            $buckets[$key]['total'] = round($values['contributions'] + $values['commissions'], 2);
        }

        return $buckets;
    }

    private function emptyBucket(string $key): array
    {
        return [
            'bucket' => $key,
            'contributions' => 0.0,
            'contributions_orders' => 0,
            'commissions' => 0.0,
            'total' => 0.0,
        ];
    }

    private function getContributions(string $bucket, ?Carbon $since): array
    {
        $bucketExpression = $bucket === self::BUCKET_MONTH
            ? "to_char(date_trunc('month', o.created_at), 'YYYY-MM')"
            : 'o.currency';

        $sinceCondition = $since !== null ? 'AND o.created_at >= :since' : '';

        $query = <<<SQL
            SELECT
                {$bucketExpression} AS bucket,
                COALESCE(SUM(o.platform_contribution), 0) AS amount,
                COUNT(*) AS orders_count
            FROM orders o
            WHERE o.deleted_at IS NULL
              AND o.status = :statusCompleted
              AND o.payment_status = :paymentStatusPaid
              AND o.platform_contribution > 0
              AND (o.refund_status IS NULL OR o.refund_status <> :refundStatusRefunded)
              {$sinceCondition}
            GROUP BY 1
        SQL;

        return DB::select($query, array_filter([
            'statusCompleted' => OrderStatus::COMPLETED->name,
            'paymentStatusPaid' => OrderPaymentStatus::PAYMENT_RECEIVED->name,
            'refundStatusRefunded' => OrderRefundStatus::REFUNDED->name,
            'since' => $since,
        ], static fn($value) => $value !== null));
    }

    private function getCommissions(string $bucket, ?Carbon $since): array
    {
        $bucketExpression = $bucket === self::BUCKET_MONTH
            ? "to_char(date_trunc('month', f.created_at), 'YYYY-MM')"
            : 'f.currency';

        $sinceCondition = $since !== null ? 'AND f.created_at >= :since' : '';

        $query = <<<SQL
            SELECT
                {$bucketExpression} AS bucket,
                COALESCE(SUM(
                    GREATEST(
                        f.amount - CASE
                            WHEN f.payment_method = :stripe
                                THEN COALESCE(o.platform_contribution, 0) * :contributionRetention
                            ELSE 0
                        END,
                        0
                    )
                ), 0) AS amount
            FROM order_application_fees f
            INNER JOIN orders o ON o.id = f.order_id AND o.deleted_at IS NULL
            WHERE f.deleted_at IS NULL
              AND f.status = :feeStatusPaid
              AND (o.refund_status IS NULL OR o.refund_status <> :refundStatusRefunded)
              {$sinceCondition}
            GROUP BY 1
        SQL;

        return DB::select($query, array_filter([
            'stripe' => PaymentProviders::STRIPE->value,
            'contributionRetention' => $this->contributionRetentionRate(),
            'feeStatusPaid' => OrderApplicationFeeStatus::PAID->value,
            'refundStatusRefunded' => OrderRefundStatus::REFUNDED->name,
            'since' => $since,
        ], static fn($value) => $value !== null));
    }

    /**
     * Part de la contribution qui atterrit reellement sur le compte de la
     * plateforme: le reste est la part variable des frais Stripe, que la
     * plateforme absorbe pour que la contribution ne coute rien a l'organisateur.
     */
    private function contributionRetentionRate(): float
    {
        $percentage = (float)$this->config->get('services.stripe.processing_fee_percentage', 0);

        return max(0.0, 1 - ($percentage / 100));
    }

    private function sum(array $buckets, string $key): float
    {
        return round(array_sum(array_column($buckets, $key)), 2);
    }
}
