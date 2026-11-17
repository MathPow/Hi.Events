<?php

namespace HiEvents\Services\Domain\Assistant;

use HiEvents\Repository\Interfaces\AssistantUsageRepositoryInterface;
use Illuminate\Config\Repository;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Carbon;

/**
 * Combien l'assistant peut servir un compte. Deux plafonds : un nombre de
 * tours par jour (chaque appel au modele compte, une lecture d'outil en
 * demande un de plus ; le compteur repart a minuit, heure de Quebec), et un
 * budget en dollars par semaine (le cout deja enregistre depuis lundi minuit).
 * Le tour qui franchit le budget va jusqu'au bout ; le suivant est refuse.
 */
class AssistantQuotaService
{
    private const TIMEZONE = 'America/Toronto';

    public function __construct(
        private readonly Cache                             $cache,
        private readonly Repository                        $config,
        private readonly AssistantUsageRepositoryInterface $usageRepository,
    )
    {
    }

    public function limit(): int
    {
        return max(0, (int)$this->config->get('services.anthropic.assistant_daily_limit'));
    }

    /** Dollars americains par compte et par semaine ; 0 : pas de plafond. */
    public function weeklyBudget(): float
    {
        return max(0.0, (float)$this->config->get('services.anthropic.assistant_weekly_budget_usd'));
    }

    public function isOverWeeklyBudget(int $accountId): bool
    {
        $budget = $this->weeklyBudget();
        if ($budget <= 0) {
            return false;
        }

        $since = Carbon::now(self::TIMEZONE)->startOfWeek(Carbon::MONDAY)->utc();

        return $this->usageRepository->getAccountCostSince($accountId, $since) >= $budget;
    }

    public function remaining(int $accountId): int
    {
        if ($this->isOverWeeklyBudget($accountId)) {
            return 0;
        }

        return max(0, $this->limit() - (int)$this->cache->get($this->key($accountId), 0));
    }

    /** Compte un tour ; faux si le compte a deja tout utilise aujourd'hui ou cette semaine. */
    public function consume(int $accountId): bool
    {
        if ($this->remaining($accountId) <= 0) {
            return false;
        }

        $key = $this->key($accountId);
        $this->cache->add($key, 0, now()->addDays(2));
        $this->cache->increment($key);

        return true;
    }

    /** Pourquoi consume() a refuse, dans la langue de l'organisateur. */
    public function refusalMessage(int $accountId): string
    {
        return $this->isOverWeeklyBudget($accountId)
            ? __('The assistant has used its budget for this week on this account. It will be back on Monday.')
            : __('The assistant has reached its daily limit for this account. It will be back tomorrow.');
    }

    private function key(int $accountId): string
    {
        return sprintf('assistant:tours:%d:%s', $accountId, now(self::TIMEZONE)->toDateString());
    }
}
