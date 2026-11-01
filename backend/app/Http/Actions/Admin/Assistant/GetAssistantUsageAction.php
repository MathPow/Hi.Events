<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Admin\Assistant;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Admin\GetAssistantUsageHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** What the organizers' assistant costs the platform, per account and per person. */
class GetAssistantUsageAction extends BaseAction
{
    public function __construct(
        private readonly GetAssistantUsageHandler $handler,
    )
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $this->minimumAllowedRole(Role::SUPERADMIN);

        // 0: since the first call.
        $days = (int)$request->query('days', 30);

        $usage = $this->handler->handle($days > 0 ? min($days, 3650) : null);

        return $this->jsonResponse($usage->toArray());
    }
}
