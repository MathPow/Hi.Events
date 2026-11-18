<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Admin\Assistant;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Domain\Assistant\AssistantQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** What the assistant may cost each account per week, in US dollars. 0: no cap. null: back to the server's configuration. */
class UpdateAssistantBudgetAction extends BaseAction
{
    public function __construct(
        private readonly AssistantQuotaService $quotaService,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request): JsonResponse
    {
        $this->minimumAllowedRole(Role::SUPERADMIN);

        $validated = $request->validate([
            'budget' => ['present', 'nullable', 'numeric', 'min:0', 'max:1000'],
        ]);

        $budget = $validated['budget'];
        $this->quotaService->chooseWeeklyBudget($budget === null ? null : (float)$budget);

        return $this->jsonResponse([
            'weekly_budget' => $this->quotaService->weeklyBudget(),
        ]);
    }
}
