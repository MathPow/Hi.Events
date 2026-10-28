<?php

namespace HiEvents\Http\Actions\TicketLookup;

use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\Request\TicketLookup\SendTicketLookupEmailRequest;
use HiEvents\Services\Application\Handlers\TicketLookup\DTO\SendTicketLookupEmailDTO;
use HiEvents\Services\Application\Handlers\TicketLookup\SendTicketLookupEmailHandler;
use Illuminate\Http\JsonResponse;

class SendTicketLookupEmailAction extends BaseAction
{
    public function __construct(
        private readonly SendTicketLookupEmailHandler $sendTicketLookupEmailHandler,
    ) {
    }

    public function __invoke(SendTicketLookupEmailRequest $request): JsonResponse
    {
        $token = $this->sendTicketLookupEmailHandler->handle(
            new SendTicketLookupEmailDTO(
                email: $request->validated('email'),
            )
        );

        $data = [
            'message' => __('If you have tickets associated with this email, we will send you an email with the details.'),
        ];

        if ($token !== null && config('app.skip_email_verification')) {
            $data['token'] = $token;
        }

        return $this->jsonResponse(data: $data);
    }
}
