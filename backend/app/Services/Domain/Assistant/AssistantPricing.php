<?php

namespace HiEvents\Services\Domain\Assistant;

/**
 * Ce qu'un appel de l'assistant coute a la plateforme, en dollars americains,
 * d'apres les tarifs publics d'Anthropic (octobre 2026). Un ecart avec la
 * facture d'Anthropic se corrige ici.
 */
class AssistantPricing
{
    /** Dollars par million de jetons : entree, sortie, lecture du cache. */
    private const PRICES = [
        'claude-fable-5-1' => [10.00, 50.00, 0.25],
        'claude-mythos-5-1' => [10.00, 50.00, 0.25],
        'claude-fable-5' => [10.00, 50.00, 1.00],
        'claude-opus-5-5' => [4.00, 20.00, 0.20],
        'claude-opus-5' => [5.00, 25.00, 0.50],
        'claude-opus-4-8' => [5.00, 25.00, 0.50],
        'claude-opus-4-7' => [5.00, 25.00, 0.50],
        'claude-opus-4-6' => [5.00, 25.00, 0.50],
        'claude-sonnet-5-5' => [2.00, 10.00, 0.20],
        'claude-sonnet-5' => [2.00, 10.00, 0.20],
        'claude-sonnet-4-6' => [3.00, 15.00, 0.30],
        'claude-haiku-5-5' => [0.10, 0.50, 0.01],
        'claude-haiku-4-5' => [1.00, 5.00, 0.10],
    ];

    /** Un modele inconnu se compte au prix d'Opus, pour ne pas sous-estimer. */
    private const UNKNOWN_MODEL = 'claude-opus-5';

    /** Ecrire dans le cache coute plus que lire l'entree : 1,25 fois pour 5 minutes, 2 fois pour une heure. */
    private const CACHE_WRITE_5M = 1.25;

    private const CACHE_WRITE_1H = 2.0;

    /** Haiku 5.5 coute 5 fois plus au-dela de 100 000 jetons d'entree. */
    private const HAIKU_LONG_PROMPT = 100_000;

    public function cost(
        string $model,
        int    $inputTokens,
        int    $cacheWrite5mTokens,
        int    $cacheWrite1hTokens,
        int    $cacheReadTokens,
        int    $outputTokens,
    ): float
    {
        [$input, $output, $cacheRead] = $this->prices($model);

        $prompt = $inputTokens + $cacheWrite5mTokens + $cacheWrite1hTokens + $cacheReadTokens;
        $multiplier = str_starts_with($model, 'claude-haiku-5-5') && $prompt > self::HAIKU_LONG_PROMPT ? 5 : 1;

        return $multiplier * (
            $inputTokens * $input
            + $cacheWrite5mTokens * $input * self::CACHE_WRITE_5M
            + $cacheWrite1hTokens * $input * self::CACHE_WRITE_1H
            + $cacheReadTokens * $cacheRead
            + $outputTokens * $output
        ) / 1_000_000;
    }

    public function isKnown(string $model): bool
    {
        return $this->match($model) !== null;
    }

    /** @return array{float, float, float} */
    private function prices(string $model): array
    {
        return self::PRICES[$this->match($model) ?? self::UNKNOWN_MODEL];
    }

    /** Le plus long identifiant qui commence le modele : claude-opus-5-5 avant claude-opus-5. */
    private function match(string $model): ?string
    {
        $best = null;
        foreach (array_keys(self::PRICES) as $known) {
            if (str_starts_with($model, $known) && strlen($known) > strlen($best ?? '')) {
                $best = $known;
            }
        }

        return $best;
    }
}
