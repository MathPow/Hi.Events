<?php

namespace HiEvents\Http\Actions\EmailTemplates;

use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Exceptions\AccountNotVerifiedException;
use HiEvents\Exceptions\EmailTemplateValidationException;
use HiEvents\Http\Resources\EmailTemplateResource;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\UpsertEmailCustomizationDTO;
use HiEvents\Services\Application\Handlers\EmailTemplate\UpsertEmailCustomizationHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * « Courriels »: the subject and message of a participant email, for all the organizer's events.
 */
class UpsertOrganizerEmailCustomizationAction extends BaseEmailTemplateAction
{
    public function __construct(
        private readonly UpsertEmailCustomizationHandler $handler,
    )
    {
    }

    /**
     * @throws ValidationException
     */
    public function __invoke(Request $request, int $organizerId, string $templateType): JsonResponse|Response
    {
        $this->isActionAuthorized($organizerId, OrganizerDomainObject::class);

        try {
            $this->verifyAccountCanModifyEmailTemplates();
        } catch (AccountNotVerifiedException $e) {
            return $this->errorResponse($e->getMessage(), HttpResponse::HTTP_UNAUTHORIZED);
        }

        $type = EmailTemplateType::tryFrom($templateType);
        if ($type === null || $type->hasFullEditor()) {
            return $this->errorResponse(__('Invalid template type'), HttpResponse::HTTP_BAD_REQUEST);
        }

        $validated = $request->validate([
            'subject' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:20000'],
        ]);

        try {
            $template = $this->handler->handle(new UpsertEmailCustomizationDTO(
                accountId: $this->getAuthenticatedAccountId(),
                organizerId: $organizerId,
                type: $type,
                subject: $validated['subject'] ?? null,
                message: $validated['message'] ?? null,
            ));
        } catch (EmailTemplateValidationException $e) {
            throw ValidationException::withMessages($e->validationErrors ?: ['message' => $e->getMessage()]);
        }

        if ($template === null) {
            return $this->deletedResponse();
        }

        return $this->resourceResponse(EmailTemplateResource::class, $template);
    }
}
