<?php

namespace HiEvents\Http\Actions\TicketLookup;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Domain\TicketLookup\TicketLookupSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CloseTicketLookupSessionAction extends BaseAction
{
    public function __construct(
        private readonly TicketLookupSessionService $sessionService,
    ) {
    }

    public function __invoke(Request $request): JsonResponse
    {
        return $this->jsonResponse(['message' => 'OK'])
            ->withCookie($this->sessionService->forgetCookie($request));
    }
}
