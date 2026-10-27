<?php

namespace HiEvents\Services\Application\Handlers\Assistant;

use Anthropic\Beta\Messages\BetaMessage;
use Anthropic\Beta\Messages\BetaRawContentBlockDeltaEvent;
use Anthropic\Beta\Messages\BetaTextDelta;
use Anthropic\Beta\Messages\BetaThinkingDelta;
use Anthropic\Core\Exceptions\APIConnectionException;
use Anthropic\Core\Exceptions\APIStatusException;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\BadRequestException;
use Anthropic\Core\Exceptions\PermissionDeniedException;
use Anthropic\Core\Exceptions\RateLimitException;
use Anthropic\Lib\Streaming\MessageAccumulator;
use HiEvents\Services\Domain\Assistant\AssistantInstructions;
use HiEvents\Services\Infrastructure\Anthropic\AnthropicClientFactory;
use Illuminate\Config\Repository;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Un tour de l'assistant des organisateurs : la conversation part chez
 * Anthropic et la reponse revient au fil de l'ecriture. Les outils ne
 * tournent pas ici : le navigateur les lance et revient avec leurs resultats
 * au tour suivant. La conversation est renvoyee telle quelle, sans retouche,
 * pour que les reflexions signees du modele restent valides.
 */
class AssistantTurnHandler
{
    private const MAX_TOKENS = 16000;

    /** Sans rien ecrire plus longtemps, nginx ou Cloudflare couperaient la reponse. */
    private const PING_SECONDS = 10;

    private const EFFORTS = ['low', 'medium', 'high'];

    public function __construct(
        private readonly AnthropicClientFactory $clientFactory,
        private readonly AssistantInstructions  $instructions,
        private readonly Repository             $config,
        private readonly LoggerInterface        $logger,
    )
    {
    }

    /**
     * Chaque evenement passe par $write :
     *   ['type' => 'texte'|'reflexion', 'texte' => ...]   au fil de l'ecriture
     *   ['type' => 'ping']                                 pendant un long appel d'outil
     *   ['type' => 'fin', 'contenu' => [...], 'arret' => ...] le message complet, a renvoyer tel quel
     *   ['type' => 'erreur', 'texte' => ...]
     *
     * @param array<int, array<string, mixed>> $messages au format de l'API d'Anthropic
     * @param callable(array<string, mixed>): void $write
     * @param callable(): bool $stopped vrai quand la personne a ferme la connexion
     */
    public function handle(int $accountId, array $messages, callable $write, callable $stopped): void
    {
        $accumulator = MessageAccumulator::forBetaMessages();
        $lastWrite = microtime(true);

        try {
            $stream = $this->clientFactory->create()->beta->messages->createStream(
                maxTokens: self::MAX_TOKENS,
                messages: $messages,
                model: $this->model(),
                cacheControl: ['type' => 'ephemeral'],
                fallbacks: 'default',
                outputConfig: ['effort' => $this->effort()],
                system: $this->instructions->system(),
                thinking: ['type' => 'adaptive', 'display' => 'summarized'],
                tools: $this->instructions->tools(),
                betas: ['server-side-fallback-2026-07-01'],
            );

            try {
                foreach ($stream as $event) {
                    $accumulator->accumulate($event);
                    $chunk = $this->chunk($event);
                    if ($chunk !== null) {
                        $write($chunk);
                        $lastWrite = microtime(true);
                    } elseif (microtime(true) - $lastWrite > self::PING_SECONDS) {
                        $write(['type' => 'ping']);
                        $lastWrite = microtime(true);
                    }
                    if ($stopped()) {
                        return;
                    }
                }
            } finally {
                $stream->close();
            }

            /** @var BetaMessage $message */
            $message = $accumulator->message();
            $this->logUsage($accountId, $message);

            if ($message->stopReason === 'refusal') {
                $write(['type' => 'erreur', 'texte' => 'Je ne peux pas répondre à cette demande.']);
                return;
            }

            $write([
                'type' => 'fin',
                'contenu' => json_decode(json_encode($message->content, JSON_THROW_ON_ERROR), true, flags: JSON_THROW_ON_ERROR),
                'arret' => $message->stopReason,
            ]);
        } catch (Throwable $exception) {
            if (!$stopped()) {
                $write(['type' => 'erreur', 'texte' => $this->reason($exception, $accountId)]);
            }
        }
    }

    public function model(): string
    {
        return (string)$this->config->get('services.anthropic.assistant_model') ?: 'claude-sonnet-5-5';
    }

    private function effort(): string
    {
        $effort = (string)$this->config->get('services.anthropic.assistant_effort');

        return in_array($effort, self::EFFORTS, true) ? $effort : 'medium';
    }

    /** @return array<string, string>|null */
    private function chunk(mixed $event): ?array
    {
        if (!$event instanceof BetaRawContentBlockDeltaEvent) {
            return null;
        }

        return match (true) {
            $event->delta instanceof BetaTextDelta => ['type' => 'texte', 'texte' => $event->delta->text],
            $event->delta instanceof BetaThinkingDelta => ['type' => 'reflexion', 'texte' => $event->delta->thinking],
            default => null,
        };
    }

    private function logUsage(int $accountId, BetaMessage $message): void
    {
        $usage = $message->usage;
        $this->logger->info('Assistant turn', [
            'account_id' => $accountId,
            'model' => $message->model,
            'stop_reason' => $message->stopReason,
            'input_tokens' => $usage->inputTokens,
            'cache_read_input_tokens' => $usage->cacheReadInputTokens,
            'cache_creation_input_tokens' => $usage->cacheCreationInputTokens,
            'output_tokens' => $usage->outputTokens,
        ]);
    }

    private function reason(Throwable $exception, int $accountId): string
    {
        $this->logger->warning('Assistant turn failed', [
            'account_id' => $accountId,
            'exception' => $exception::class,
            'message' => $exception->getMessage(),
        ]);

        return match (true) {
            $exception instanceof AuthenticationException, $exception instanceof PermissionDeniedException
                => "La clé d'Anthropic de la billetterie est refusée. Écrivez à support@dehorsqc.com.",
            $exception instanceof RateLimitException
                => 'Trop de demandes d’un coup : réessayez dans une minute.',
            $exception instanceof BadRequestException && stripos($exception->getMessage(), 'credit balance') !== false
                => "L'assistant n'a plus de crédit. Écrivez à support@dehorsqc.com.",
            $exception instanceof APIStatusException
                => sprintf('Anthropic a répondu %s : %s', $exception->status ?? 'une erreur', $exception->getMessage()),
            $exception instanceof APIConnectionException
                => "Anthropic ne répond pas. Réessayez dans un instant.",
            default => "L'assistant a eu un problème. Réessayez.",
        };
    }
}
