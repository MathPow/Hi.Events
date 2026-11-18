<?php

namespace HiEvents\Http\Actions\EventChange\Public;

use HiEvents\Exceptions\InvalidRefundRequestTokenException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestDTO;
use HiEvents\Services\Application\Handlers\EventChange\GetRefundRequestHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class GetRefundRequestPublicAction extends BaseAction
{
    public function __construct(private readonly GetRefundRequestHandler $handler)
    {
    }

    public function __invoke(Request $request, int $eventId, string $orderShortId): JsonResponse|Response
    {
        try {
            $view = $this->handler->handle(new RefundRequestDTO(
                eventId: $eventId,
                orderShortId: $orderShortId,
                dateChangeId: $request->integer('change'),
                token: $request->string('token')->toString() ?: null,
            ));
        } catch (InvalidRefundRequestTokenException) {
            return $this->notFoundResponse();
        }

        return $this->jsonResponse($view->toArray(), wrapInData: true);
    }
}
