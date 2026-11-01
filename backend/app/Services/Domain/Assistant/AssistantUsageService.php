<?php

namespace HiEvents\Services\Domain\Assistant;

use Anthropic\Beta\Messages\BetaMessage;
use HiEvents\DomainObjects\Generated\AssistantUsageDomainObjectAbstract;
use HiEvents\Repository\Interfaces\AssistantUsageRepositoryInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Note ce qu'un appel de l'assistant a coute, pour l'administration. Avec un
 * repli (fallbacks), usage.iterations detaille chaque tentative a son propre
 * prix ; sans, l'usage du message suffit.
 */
class AssistantUsageService
{
    public function __construct(
        private readonly AssistantUsageRepositoryInterface $usageRepository,
        private readonly AssistantPricing                  $pricing,
        private readonly LoggerInterface                   $logger,
    )
    {
    }

    public function record(int $accountId, ?int $userId, BetaMessage $message, ?string $stopReason): void
    {
        $usage = $message->usage;
        $attempts = array_values(array_filter(
            $this->field($usage, 'iterations') ?? [],
            fn(mixed $attempt) => is_object($attempt) && $this->field($attempt, 'inputTokens') !== null,
        ));
        if ($attempts === []) {
            $attempts = [$usage];
        }

        $tokens = ['input' => 0, 'cache_write' => 0, 'cache_read' => 0, 'output' => 0];
        $cost = 0.0;
        foreach ($attempts as $attempt) {
            $model = $this->field($attempt, 'model') ?? $message->model;
            $input = (int)$this->field($attempt, 'inputTokens');
            $cacheWrite = (int)$this->field($attempt, 'cacheCreationInputTokens');
            $cacheCreation = $this->field($attempt, 'cacheCreation');
            $cacheWrite1h = is_object($cacheCreation) ? (int)$this->field($cacheCreation, 'ephemeral1hInputTokens') : 0;
            $cacheRead = (int)$this->field($attempt, 'cacheReadInputTokens');
            $output = (int)$this->field($attempt, 'outputTokens');

            $tokens['input'] += $input;
            $tokens['cache_write'] += $cacheWrite;
            $tokens['cache_read'] += $cacheRead;
            $tokens['output'] += $output;

            $cost += $this->pricing->cost(
                model: $model,
                inputTokens: $input,
                cacheWrite5mTokens: max(0, $cacheWrite - $cacheWrite1h),
                cacheWrite1hTokens: $cacheWrite1h,
                cacheReadTokens: $cacheRead,
                outputTokens: $output,
            );

            if (!$this->pricing->isKnown($model)) {
                $this->logger->warning('Assistant model without a price, counted at Opus rates', ['model' => $model]);
            }
        }

        // Ne jamais faire echouer la reponse a la personne pour une ligne de suivi.
        try {
            $this->usageRepository->create([
                AssistantUsageDomainObjectAbstract::ACCOUNT_ID => $accountId,
                AssistantUsageDomainObjectAbstract::USER_ID => $userId,
                AssistantUsageDomainObjectAbstract::MODEL => $message->model,
                AssistantUsageDomainObjectAbstract::INPUT_TOKENS => $tokens['input'],
                AssistantUsageDomainObjectAbstract::CACHE_CREATION_INPUT_TOKENS => $tokens['cache_write'],
                AssistantUsageDomainObjectAbstract::CACHE_READ_INPUT_TOKENS => $tokens['cache_read'],
                AssistantUsageDomainObjectAbstract::OUTPUT_TOKENS => $tokens['output'],
                AssistantUsageDomainObjectAbstract::COST_USD => round($cost, 6),
                AssistantUsageDomainObjectAbstract::STOP_REASON => $stopReason,
            ]);
        } catch (Throwable $exception) {
            $this->logger->error('Could not record assistant usage', [
                'account_id' => $accountId,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    /**
     * Un champ du SDK, ou null : ses objets levent une exception sur un champ
     * qu'ils n'ont pas (le modele n'est pas dans l'usage d'un message simple).
     */
    private function field(object $object, string $name): mixed
    {
        return property_exists($object, $name) ? $object->{$name} : null;
    }
}
