<?php

namespace HiEvents\Repository\Eloquent;

use Carbon\Carbon;
use HiEvents\DomainObjects\AssistantUsageDomainObject;
use HiEvents\Models\AssistantUsage;
use HiEvents\Repository\Interfaces\AssistantUsageRepositoryInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * @extends BaseRepository<AssistantUsageDomainObject>
 */
class AssistantUsageRepository extends BaseRepository implements AssistantUsageRepositoryInterface
{
    /** The day of a call in Quebec time, like the daily quota (AssistantQuotaService). */
    private const DAY = "(u.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Toronto')::date";

    protected function getModel(): string
    {
        return AssistantUsage::class;
    }

    public function getDomainObject(): string
    {
        return AssistantUsageDomainObject::class;
    }

    public function getTotalsSince(Carbon $since): object
    {
        return $this->usagesSince($since)
            ->selectRaw(<<<SQL
                COUNT(*) AS turns,
                COUNT(DISTINCT u.account_id) AS accounts,
                COUNT(DISTINCT u.user_id) AS users,
                COALESCE(SUM(u.input_tokens), 0) AS input_tokens,
                COALESCE(SUM(u.cache_creation_input_tokens), 0) AS cache_creation_input_tokens,
                COALESCE(SUM(u.cache_read_input_tokens), 0) AS cache_read_input_tokens,
                COALESCE(SUM(u.output_tokens), 0) AS output_tokens,
                COALESCE(SUM(u.cost_usd), 0) AS cost_usd
            SQL)
            ->first();
    }

    public function getDailySince(Carbon $since): Collection
    {
        return $this->usagesSince($since)
            ->selectRaw(self::DAY . ' AS day, COUNT(*) AS turns, COUNT(DISTINCT u.account_id) AS accounts, SUM(u.cost_usd) AS cost_usd')
            ->groupByRaw(self::DAY)
            ->orderBy('day')
            ->get();
    }

    public function getByAccountSince(Carbon $since): Collection
    {
        $busiestDay = $this->usagesSince($since)
            ->selectRaw('u.account_id, COUNT(*) AS turns')
            ->groupByRaw('u.account_id, ' . self::DAY);

        return $this->usagesSince($since)
            ->join('accounts as a', 'a.id', '=', 'u.account_id')
            ->leftJoinSub(
                DB::query()->fromSub($busiestDay, 'd')->selectRaw('d.account_id, MAX(d.turns) AS turns')->groupBy('d.account_id'),
                'busiest',
                'busiest.account_id',
                '=',
                'u.account_id',
            )
            ->selectRaw(sprintf(<<<SQL
                a.id AS account_id,
                a.name AS account_name,
                a.email AS account_email,
                (SELECT STRING_AGG(o.name, ', ' ORDER BY o.id) FROM organizers o
                    WHERE o.account_id = a.id AND o.deleted_at IS NULL) AS organizers,
                COUNT(*) AS turns,
                COUNT(DISTINCT u.user_id) AS users,
                COUNT(DISTINCT %s) AS active_days,
                MAX(busiest.turns) AS busiest_day_turns,
                SUM(u.input_tokens) AS input_tokens,
                SUM(u.cache_creation_input_tokens) AS cache_creation_input_tokens,
                SUM(u.cache_read_input_tokens) AS cache_read_input_tokens,
                SUM(u.output_tokens) AS output_tokens,
                SUM(u.cost_usd) AS cost_usd,
                MIN(u.created_at) AS first_used_at,
                MAX(u.created_at) AS last_used_at
            SQL, self::DAY))
            ->groupBy('a.id', 'a.name', 'a.email')
            ->orderByDesc('cost_usd')
            ->get();
    }

    public function getByUserSince(Carbon $since): Collection
    {
        return $this->usagesSince($since)
            ->join('accounts as a', 'a.id', '=', 'u.account_id')
            ->leftJoin('users as p', 'p.id', '=', 'u.user_id')
            ->selectRaw(sprintf(<<<SQL
                u.user_id,
                p.first_name,
                p.last_name,
                p.email,
                a.id AS account_id,
                a.name AS account_name,
                COUNT(*) AS turns,
                COUNT(DISTINCT %s) AS active_days,
                SUM(u.output_tokens) AS output_tokens,
                SUM(u.cost_usd) AS cost_usd,
                MAX(u.created_at) AS last_used_at
            SQL, self::DAY))
            ->groupBy('u.user_id', 'p.first_name', 'p.last_name', 'p.email', 'a.id', 'a.name')
            ->orderByDesc('cost_usd')
            ->limit(200)
            ->get();
    }

    private function usagesSince(Carbon $since): Builder
    {
        return DB::table('assistant_usages as u')->where('u.created_at', '>=', $since);
    }
}
