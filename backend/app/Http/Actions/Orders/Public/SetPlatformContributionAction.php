<?php

namespace HiEvents\Http\Actions\Orders\Public;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Order\SetPlatformContributionRequest;
use HiEvents\Resources\Order\OrderResourcePublic;
use HiEvents\Services\Application\Handlers\Order\Public\SetPlatformContributionHandler;
use Illuminate\Http\JsonResponse;

class SetPlatformContributionAction extends BaseAction
{
    public function __construct(
        private readonly SetPlatformContributionHandler $handler,
    )
    {
    }

    public function __invoke(SetPlatformContributionRequest $request, int $eventId, string $orderShortId): JsonResponse
    {
        $order = $this->handler->handle(
            eventId: $eventId,
            orderShortId: $orderShortId,
            contribution: (float)$request->validated('platform_contribution'),
        );

        return $this->resourceResponse(OrderResourcePublic::class, $order);
    }
}
