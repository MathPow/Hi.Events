<?php

namespace HiEvents\Http\Actions\TicketLookup;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Resources\Order\OrderResourcePublic;
use HiEvents\Services\Application\Handlers\TicketLookup\GetTicketLookupOrdersHandler;
use HiEvents\Services\Domain\TicketLookup\TicketLookupSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GetTicketLookupOrdersAction extends BaseAction
{
    public function __construct(
        private readonly GetTicketLookupOrdersHandler $handler,
        private readonly TicketLookupSessionService $sessionService,
    ) {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $email = $this->sessionService->emailFrom($request);

        if ($email === null) {
            return $this->errorResponse(
                message: __('Please request a new link to see your tickets.'),
                statusCode: ResponseCodes::HTTP_UNAUTHORIZED,
            );
        }

        return $this->resourceResponse(
            resource: OrderResourcePublic::class,
            data: $this->handler->handle($email),
        );
    }
}
