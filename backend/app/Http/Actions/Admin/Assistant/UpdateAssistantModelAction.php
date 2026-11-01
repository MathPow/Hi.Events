<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Admin\Assistant;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Domain\Assistant\AssistantModelService;
use HiEvents\Services\Domain\Assistant\UnknownAssistantModelException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** The model the assistant runs on for every account. null: back to the server's configuration. */
class UpdateAssistantModelAction extends BaseAction
{
    public function __construct(
        private readonly AssistantModelService $modelService,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request): JsonResponse
    {
        $this->minimumAllowedRole(Role::SUPERADMIN);

        $model = $request->input('model');

        try {
            $this->modelService->choose(is_string($model) && $model !== '' ? $model : null);
        } catch (UnknownAssistantModelException) {
            throw ValidationException::withMessages([
                'model' => __('The assistant cannot run on this model.'),
            ]);
        }

        return $this->jsonResponse([
            'model' => $this->modelService->current(),
        ]);
    }
}
