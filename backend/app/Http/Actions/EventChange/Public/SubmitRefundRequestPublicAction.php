<?php

namespace HiEvents\Http\Actions\EventChange\Public;

use HiEvents\Exceptions\InvalidRefundRequestTokenException;
use HiEvents\Exceptions\RefundNotPossibleException;
use HiEvents\Exceptions\RefundRequestNotAllowedException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestDTO;
use HiEvents\Services\Application\Handlers\EventChange\SubmitRefundRequestHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Psr\Log\LoggerInterface;
use Stripe\Exception\ApiErrorException;
use Symfony\Component\HttpFoundation\Response as HttpResponse;
use Throwable;

class SubmitRefundRequestPublicAction extends BaseAction
{
    public function __construct(
        private readonly SubmitRefundRequestHandler $handler,
        private readonly LoggerInterface            $logger,
    )
    {
    }

    /**
     * @throws Throwable
     */
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
        } catch (RefundRequestNotAllowedException $exception) {
            return $this->errorResponse($exception->getMessage(), HttpResponse::HTTP_CONFLICT, [
                'refusal' => $exception->refusal->name,
            ]);
        } catch (ApiErrorException|RefundNotPossibleException $exception) {
            $this->logger->error('Refund request: the refund failed, the order stays as it was', [
                'event_id' => $eventId,
                'order_short_id' => $orderShortId,
                'exception' => $exception->getMessage(),
            ]);

            return $this->errorResponse(
                __('The refund could not be made. Nothing was cancelled: try again in a few minutes, or write to the organizer.'),
                HttpResponse::HTTP_UNPROCESSABLE_ENTITY,
            );
        }

        return $this->jsonResponse($view->toArray(), wrapInData: true);
    }
}
