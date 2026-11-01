<?php

declare(strict_types=1);

namespace HiEvents\Services\Application\Handlers\EmailTemplate;

use HiEvents\DomainObjects\EmailTemplateDomainObject;
use HiEvents\DomainObjects\Enums\EmailTemplateEngine;
use HiEvents\Exceptions\EmailTemplateValidationException;
use HiEvents\Repository\Interfaces\EmailTemplateRepositoryInterface;
use HiEvents\Services\Application\Handlers\EmailTemplate\DTO\UpsertEmailCustomizationDTO;
use HiEvents\Services\Domain\Email\EmailTemplateService;
use HiEvents\Services\Infrastructure\HtmlPurifier\HtmlPurifierService;

/**
 * The organizer's subject and message for a participant email that keeps its content (« Courriels »).
 * Both empty: back to the default email.
 */
class UpsertEmailCustomizationHandler
{
    public function __construct(
        private readonly EmailTemplateRepositoryInterface $templateRepository,
        private readonly EmailTemplateService             $templateService,
        private readonly HtmlPurifierService              $purifier,
    )
    {
    }

    /**
     * @throws EmailTemplateValidationException
     */
    public function handle(UpsertEmailCustomizationDTO $dto): ?EmailTemplateDomainObject
    {
        if ($dto->type->hasFullEditor()) {
            throw new EmailTemplateValidationException(__('This email is changed with the full editor.'));
        }

        $subject = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$dto->subject)));
        $message = trim((string)$this->purifier->purify((string)$dto->message));
        if (trim(html_entity_decode(strip_tags($message))) === '') {
            $message = '';
        }

        $validation = $this->templateService->validateTemplate($subject, $message);
        if (!$validation['valid']) {
            $exception = new EmailTemplateValidationException(__('Some automatic info is badly written.'));
            $exception->validationErrors = [
                ...isset($validation['errors']['subject']) ? ['subject' => $validation['errors']['subject']] : [],
                ...isset($validation['errors']['body']) ? ['message' => $validation['errors']['body']] : [],
            ];
            throw $exception;
        }

        $existing = $this->templateRepository->findFirstWhere([
            'account_id' => $dto->accountId,
            'organizer_id' => $dto->organizerId,
            'event_id' => null,
            'template_type' => $dto->type->value,
        ]);

        if ($subject === '' && $message === '') {
            if ($existing !== null) {
                $this->templateRepository->deleteById($existing->getId());
            }

            return null;
        }

        $attributes = [
            'subject' => $subject,
            'body' => $message,
            'cta' => null,
            'engine' => EmailTemplateEngine::LIQUID->value,
            'is_active' => true,
        ];

        if ($existing !== null) {
            /** @var EmailTemplateDomainObject */
            return $this->templateRepository->updateFromArray($existing->getId(), $attributes);
        }

        /** @var EmailTemplateDomainObject */
        return $this->templateRepository->create([
            ...$attributes,
            'account_id' => $dto->accountId,
            'organizer_id' => $dto->organizerId,
            'event_id' => null,
            'template_type' => $dto->type->value,
        ]);
    }
}
