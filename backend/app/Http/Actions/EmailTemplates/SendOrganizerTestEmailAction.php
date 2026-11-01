<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\EmailTemplates;

use HiEvents\DomainObjects\Enums\AutomaticEmailType;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\SendOrganizerTestEmailDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\SendOrganizerTestEmailHandler;
use Illuminate\Http\JsonResponse;

class SendOrganizerTestEmailAction extends BaseAction
{
    public function __construct(
        private readonly SendOrganizerTestEmailHandler $handler,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function __invoke(int $organizerId, string $templateType): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $type = AutomaticEmailType::tryFrom($templateType);

        if ($type === null) {
            return $this->errorResponse(__('Invalid template type'), ResponseCodes::HTTP_BAD_REQUEST);
        }

        $sentTo = $this->handler->handle(new SendOrganizerTestEmailDTO(
            organizerId: $organizerId,
            accountId: $this->getAuthenticatedAccountId(),
            userId: $this->getAuthenticatedUser()->getId(),
            type: $type,
        ));

        return $this->jsonResponse(['sent_to' => $sentTo], wrapInData: true);
    }
}
