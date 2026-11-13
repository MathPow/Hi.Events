<?php

namespace HiEvents\Http\Actions\Attendees\Public;

use HiEvents\DomainObjects\Enums\TicketTransferRefusal;
use HiEvents\Exceptions\TicketTransferNotAllowedException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\Attendee\TransferTicketPublicRequest;
use HiEvents\Services\Application\Handlers\Attendee\Public\DTO\TransferTicketPublicDTO;
use HiEvents\Services\Application\Handlers\Attendee\Public\TicketTransferPublicHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response as ResponseCodes;
use Symfony\Component\Routing\Exception\ResourceNotFoundException;
use Throwable;

class TransferTicketPublicAction extends BaseAction
{
    public function __construct(private readonly TicketTransferPublicHandler $handler)
    {
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function __invoke(TransferTicketPublicRequest $request, int $eventId, string $attendeeShortId): JsonResponse|Response
    {
        try {
            $this->handler->transfer(new TransferTicketPublicDTO(
                eventId: $eventId,
                attendeeShortId: $attendeeShortId,
                firstName: $request->validated('first_name'),
                lastName: $request->validated('last_name'),
                email: $request->validated('email'),
                ipAddress: $this->getClientIp($request),
            ));
        } catch (ResourceNotFoundException) {
            return $this->notFoundResponse();
        } catch (TicketTransferNotAllowedException $exception) {
            if ($exception->refusal === TicketTransferRefusal::SAME_EMAIL) {
                throw ValidationException::withMessages(['email' => $exception->getMessage()]);
            }

            return $this->errorResponse($exception->getMessage(), ResponseCodes::HTTP_CONFLICT);
        }

        return $this->jsonResponse([
            'message' => __('The ticket has been transferred.'),
        ]);
    }
}
