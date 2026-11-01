<?php

declare(strict_types=1);

namespace HiEvents\Http\Actions\EmailTemplates;

use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\ResourceNotFoundException;
use HiEvents\Http\Actions\BaseAction;
use HiEvents\Http\ResponseCodes;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\OrganizerSampleEmailDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\GetOrganizerSampleEmailHandler;
use Illuminate\Http\JsonResponse;

/**
 * An automatic email of the organizer exactly as it is sent (its version or the default one), with sample data.
 */
class GetOrganizerSampleEmailAction extends BaseAction
{
    public function __construct(
        private readonly GetOrganizerSampleEmailHandler $handler,
    )
    {
    }

    /**
     * @throws ResourceNotFoundException
     */
    public function __invoke(int $organizerId, string $templateType): JsonResponse
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        $type = EmailTemplateType::tryFrom($templateType);

        if ($type === null) {
            return $this->errorResponse(__('Invalid template type'), ResponseCodes::HTTP_BAD_REQUEST);
        }

        $sample = $this->handler->handle(new OrganizerSampleEmailDTO(
            organizerId: $organizerId,
            accountId: $this->getAuthenticatedAccountId(),
            type: $type,
        ));

        return $this->jsonResponse($sample->toArray(), wrapInData: true);
    }
}
