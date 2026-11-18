<?php

namespace HiEvents\Http\Actions\TicketLookup;

use HiEvents\Exceptions\InvalidTicketLookupTokenException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\TicketLookup\OpenTicketLookupSessionHandler;
use HiEvents\Services\Domain\TicketLookup\TicketLookupSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OpenTicketLookupSessionAction extends BaseAction
{
    public function __construct(
        private readonly OpenTicketLookupSessionHandler $handler,
        private readonly TicketLookupSessionService $sessionService,
    ) {
    }

    public function __invoke(Request $request, string $token): JsonResponse
    {
        try {
            $email = $this->handler->handle($token);
        } catch (InvalidTicketLookupTokenException $e) {
            return $this->errorResponse(message: $e->getMessage());
        }

        return $this->jsonResponse(['message' => 'OK'])
            ->withCookie($this->sessionService->makeCookie($email, $request));
    }
}
