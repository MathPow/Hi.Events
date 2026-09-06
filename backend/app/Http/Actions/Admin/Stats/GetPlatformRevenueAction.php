<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\Admin\Stats;

use HiEvents\DomainObjects\Enums\Role;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\Admin\DTO\GetPlatformRevenueDTO;
use HiEvents\Services\Application\Handlers\Admin\GetPlatformRevenueHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GetPlatformRevenueAction extends BaseAction
{
    public function __construct(
        private readonly GetPlatformRevenueHandler $handler,
    )
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $this->minimumAllowedRole(Role::SUPERADMIN);

        $revenue = $this->handler->handle(new GetPlatformRevenueDTO(
            days: max(1, min((int)$request->query('days', 30), 365)),
            months: max(1, min((int)$request->query('months', 12), 24)),
        ));

        return $this->jsonResponse($revenue->toArray());
    }
}
