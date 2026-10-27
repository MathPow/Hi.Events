<?php

namespace HiEvents\Http\Actions\Assistant;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Assistant\AssistantTurnHandler;
use HiEvents\Services\Domain\Assistant\AssistantQuotaService;
use HiEvents\Services\Infrastructure\Anthropic\AnthropicClientFactory;
use Illuminate\Http\JsonResponse;

/** L'assistant est-il pret (cle d'Anthropic), et combien de tours restent aujourd'hui. */
class GetAssistantAction extends BaseAction
{
    public function __construct(
        private readonly AnthropicClientFactory $clientFactory,
        private readonly AssistantQuotaService  $quotaService,
        private readonly AssistantTurnHandler   $turnHandler,
    )
    {
    }

    public function __invoke(): JsonResponse
    {
        return $this->jsonResponse([
            'ready' => $this->clientFactory->isConfigured(),
            'model' => $this->turnHandler->model(),
            'remaining' => $this->quotaService->remaining($this->getAuthenticatedAccountId()),
            'limit' => $this->quotaService->limit(),
        ]);
    }
}
