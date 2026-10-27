<?php

namespace HiEvents\Services\Domain\Assistant;

use Illuminate\Config\Repository;
use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Combien de tours de l'assistant un compte peut faire par jour. Chaque appel
 * au modele compte (une lecture d'outil en demande un de plus) : c'est ce que
 * la plateforme paie a Anthropic. Le compteur repart a minuit, heure de Quebec.
 */
class AssistantQuotaService
{
    public function __construct(
        private readonly Cache      $cache,
        private readonly Repository $config,
    )
    {
    }

    public function limit(): int
    {
        return max(0, (int)$this->config->get('services.anthropic.assistant_daily_limit'));
    }

    public function remaining(int $accountId): int
    {
        return max(0, $this->limit() - (int)$this->cache->get($this->key($accountId), 0));
    }

    /** Compte un tour ; faux si le compte a deja tout utilise aujourd'hui. */
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

    private function key(int $accountId): string
    {
        return sprintf('assistant:tours:%d:%s', $accountId, now('America/Toronto')->toDateString());
    }
}
