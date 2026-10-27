<?php

namespace HiEvents\Http\Actions\Assistant;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Assistant\AssistantTurnRequest;
use HiEvents\Http\ResponseCodes;
use HiEvents\Services\Application\Handlers\Assistant\AssistantTurnHandler;
use HiEvents\Services\Domain\Assistant\AssistantQuotaService;
use HiEvents\Services\Infrastructure\Anthropic\AnthropicClientFactory;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Un tour de l'assistant des organisateurs. La reponse arrive en NDJSON, une
 * ligne par evenement (voir AssistantTurnHandler), sans tampon : nginx la
 * laisse passer au fil de l'ecriture grace a X-Accel-Buffering.
 */
class AssistantTurnAction extends BaseAction
{
    public function __construct(
        private readonly AssistantTurnHandler   $turnHandler,
        private readonly AssistantQuotaService  $quotaService,
        private readonly AnthropicClientFactory $clientFactory,
    )
    {
    }

    public function __invoke(AssistantTurnRequest $request): JsonResponse|StreamedResponse
    {
        if (!$this->clientFactory->isConfigured()) {
            return $this->errorResponse(__('The assistant is not available yet.'), ResponseCodes::HTTP_SERVICE_UNAVAILABLE);
        }

        $messages = array_values($request->input('messages'));
        if (end($messages)['role'] !== 'user') {
            return $this->errorResponse(__('The conversation must end with your message.'), ResponseCodes::HTTP_UNPROCESSABLE_ENTITY);
        }

        $accountId = $this->getAuthenticatedAccountId();
        if (!$this->quotaService->consume($accountId)) {
            return $this->errorResponse(
                __('The assistant has reached its daily limit for this account. It will be back tomorrow.'),
                ResponseCodes::HTTP_TOO_MANY_REQUESTS,
            );
        }

        return new StreamedResponse(function () use ($accountId, $messages): void {
            // Un tour peut durer quelques minutes (reflexion, longs corps).
            @set_time_limit(300);
            ignore_user_abort(true);
            while (ob_get_level() > 0) {
                ob_end_flush();
            }

            $this->turnHandler->handle(
                accountId: $accountId,
                messages: $messages,
                write: static function (array $event): void {
                    echo json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE) . "\n";
                    flush();
                },
                stopped: static fn(): bool => connection_aborted() === 1,
            );
        }, ResponseCodes::HTTP_OK, [
            'Content-Type' => 'application/x-ndjson; charset=utf-8',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
