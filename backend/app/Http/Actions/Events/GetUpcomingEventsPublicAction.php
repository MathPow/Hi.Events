<?php

namespace HiEvents\Http\Actions\Events;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Resources\Event\EventResourcePublic;
use HiEvents\Services\Application\Handlers\Event\GetUpcomingPublicEventsHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GetUpcomingEventsPublicAction extends BaseAction
{
    public function __construct(
        private readonly GetUpcomingPublicEventsHandler $handler,
    )
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        return $this->resourceResponse(
            resource: EventResourcePublic::class,
            data: $this->handler->handle($request->integer('per_page', GetUpcomingPublicEventsHandler::LIMIT)),
        );
    }
}
