<?php

namespace HiEvents\Services\Application\Handlers\Admin;

use Carbon\Carbon;
use Carbon\CarbonPeriod;
use HiEvents\Repository\Interfaces\AssistantUsageRepositoryInterface;
use HiEvents\Services\Application\Handlers\Admin\DTO\AssistantUsageResponseDTO;
use HiEvents\Services\Domain\Assistant\AssistantModelService;
use HiEvents\Services\Domain\Assistant\AssistantQuotaService;

/**
 * Ce que l'assistant coute a la plateforme, par compte et par personne, pour
 * reperer ceux qui coutent cher. Les couts sont en dollars americains, comme
 * la facture d'Anthropic.
 */
class GetAssistantUsageHandler
{
    private const TIMEZONE = 'America/Toronto';

    private const DAYS_PER_MONTH = 30;

    public function __construct(
        private readonly AssistantUsageRepositoryInterface $usageRepository,
        private readonly AssistantQuotaService             $quotaService,
        private readonly AssistantModelService             $modelService,
    )
    {
    }

    /** @param int|null $days null : depuis le debut */
    public function handle(?int $days): AssistantUsageResponseDTO
    {
        $now = Carbon::now();
        $since = $days === null
            ? Carbon::create(2000)
            : $now->copy()->setTimezone(self::TIMEZONE)->startOfDay()->subDays($days - 1)->utc();

        $totals = $this->usageRepository->getTotalsSince($since);
        $daily = $this->usageRepository->getDailySince($since);

        // Depuis le debut, la periode commence au premier appel.
        if ($days === null) {
            $first = $daily->first()?->day;
            $since = $first !== null
                ? Carbon::parse($first, self::TIMEZONE)->startOfDay()->utc()
                : $now->copy()->setTimezone(self::TIMEZONE)->startOfDay()->utc();
        }

        $turns = (int)$totals->turns;
        $cost = (float)$totals->cost_usd;
        $firstDay = $daily->first()?->day;
        $firstUse = $firstDay !== null ? Carbon::parse($firstDay, self::TIMEZONE)->startOfDay()->utc()->max($since) : $since;

        return new AssistantUsageResponseDTO(
            days: $days,
            since: $since->toIso8601String(),
            model: $this->modelService->current(),
            default_model: $this->modelService->default(),
            models: $this->modelService->options(),
            daily_limit: $this->quotaService->limit(),
            totals: [
                'turns' => $turns,
                'accounts' => (int)$totals->accounts,
                'users' => (int)$totals->users,
                'input_tokens' => (int)$totals->input_tokens,
                'cache_creation_input_tokens' => (int)$totals->cache_creation_input_tokens,
                'cache_read_input_tokens' => (int)$totals->cache_read_input_tokens,
                'output_tokens' => (int)$totals->output_tokens,
                'cost_usd' => round($cost, 4),
                'cost_per_turn' => $turns > 0 ? round($cost / $turns, 4) : 0.0,
                'monthly_rate' => round($this->monthlyRate($cost, $firstUse, $now), 2),
            ],
            daily: $this->dailySeries($daily->keyBy('day')->all(), $since, $now),
            accounts: $this->usageRepository->getByAccountSince($since)->map(fn(object $row) => [
                'account_id' => (int)$row->account_id,
                'account_name' => $row->account_name,
                'account_email' => $row->account_email,
                'organizers' => $row->organizers,
                'turns' => (int)$row->turns,
                'users' => (int)$row->users,
                'active_days' => (int)$row->active_days,
                'busiest_day_turns' => (int)$row->busiest_day_turns,
                'input_tokens' => (int)$row->input_tokens,
                'cache_creation_input_tokens' => (int)$row->cache_creation_input_tokens,
                'cache_read_input_tokens' => (int)$row->cache_read_input_tokens,
                'output_tokens' => (int)$row->output_tokens,
                'cost_usd' => round((float)$row->cost_usd, 4),
                'cost_per_turn' => round((float)$row->cost_usd / max(1, (int)$row->turns), 4),
                'share' => $cost > 0 ? round((float)$row->cost_usd / $cost * 100, 1) : 0.0,
                'monthly_rate' => round($this->monthlyRate((float)$row->cost_usd, Carbon::parse($row->first_used_at, 'UTC'), $now), 2),
                'first_used_at' => Carbon::parse($row->first_used_at, 'UTC')->toIso8601String(),
                'last_used_at' => Carbon::parse($row->last_used_at, 'UTC')->toIso8601String(),
            ])->values()->all(),
            users: $this->usageRepository->getByUserSince($since)->map(fn(object $row) => [
                'user_id' => $row->user_id !== null ? (int)$row->user_id : null,
                'first_name' => $row->first_name,
                'last_name' => $row->last_name,
                'email' => $row->email,
                'account_id' => (int)$row->account_id,
                'account_name' => $row->account_name,
                'turns' => (int)$row->turns,
                'active_days' => (int)$row->active_days,
                'output_tokens' => (int)$row->output_tokens,
                'cost_usd' => round((float)$row->cost_usd, 4),
                'cost_per_turn' => round((float)$row->cost_usd / max(1, (int)$row->turns), 4),
                'last_used_at' => Carbon::parse($row->last_used_at, 'UTC')->toIso8601String(),
            ])->values()->all(),
        );
    }

    /**
     * Ce que ca couterait sur 30 jours au meme rythme, compte depuis le premier
     * appel de la periode : un compte arrive hier ne se divise pas par 30 jours.
     */
    private function monthlyRate(float $cost, Carbon $from, Carbon $now): float
    {
        $days = max(1.0, $from->diffInSeconds($now) / 86400);

        return $cost / $days * self::DAYS_PER_MONTH;
    }

    /** Un point par jour, meme sans appel, pour un graphique sans trou. */
    private function dailySeries(array $rows, Carbon $since, Carbon $now): array
    {
        $series = [];
        $period = CarbonPeriod::create(
            $since->copy()->setTimezone(self::TIMEZONE)->startOfDay(),
            $now->copy()->setTimezone(self::TIMEZONE)->startOfDay(),
        );
        foreach ($period as $day) {
            $key = $day->toDateString();
            $row = $rows[$key] ?? null;
            $series[] = [
                'day' => $key,
                'turns' => (int)($row->turns ?? 0),
                'accounts' => (int)($row->accounts ?? 0),
                'cost_usd' => round((float)($row->cost_usd ?? 0), 4),
            ];
        }

        return $series;
    }
}
