<?php

namespace HiEvents\Http\Actions\EventChange;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\EventChange\GetEventChangeStatusHandler;
use Illuminate\Http\JsonResponse;

class GetEventChangeStatusAction extends BaseAction
{
    public function __construct(private readonly GetEventChangeStatusHandler $handler)
    {
    }

    public function __invoke(int $eventId): JsonResponse
    {
        $this->isActionAuthorized($eventId, EventDomainObject::class);

        return $this->jsonResponse($this->handler->handle($eventId)->toArray(), wrapInData: true);
    }
}
