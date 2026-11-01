<?php

namespace HiEvents\Mail\Concerns;

use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\Services\Domain\Mail\DTO\EmailCustomizationDTO;
use HiEvents\Services\Domain\Mail\EventEmailBrandingService;
use HiEvents\Services\Domain\Mail\ParticipantEmailService;
use Illuminate\Mail\Mailables\Content;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * A participant email that looks like the public event page (the organizer's color, logo and
 * cover, the event's date and place) and takes the subject and message the organizer wrote.
 * The class has the event and its organizer in $this->event and $this->organizer.
 *
 * Prepared when the email is rendered, in the language it is sent in.
 */
trait HasEventBranding
{
    private ?EmailCustomizationDTO $customization = null;

    abstract protected function emailTemplateType(): EmailTemplateType;

    protected function participantFirstName(): ?string
    {
        return null;
    }

    protected function participantLastName(): ?string
    {
        return null;
    }

    /** The organizer's subject and message; a customization that cannot be read never blocks the email. */
    protected function customization(): EmailCustomizationDTO
    {
        if ($this->customization !== null) {
            return $this->customization;
        }

        try {
            $this->customization = app(ParticipantEmailService::class)->customize(
                type: $this->emailTemplateType(),
                event: $this->event,
                organizer: $this->organizer,
                firstName: $this->participantFirstName(),
                lastName: $this->participantLastName(),
            );
        } catch (Throwable $exception) {
            app(LoggerInterface::class)->warning('Participant email: the customization could not be read', [
                'type' => $this->emailTemplateType()->value,
                'exception' => $exception->getMessage(),
            ]);
            $this->customization = new EmailCustomizationDTO();
        }

        return $this->customization;
    }

    protected function brandedSubject(string $defaultSubject): string
    {
        return $this->customization()->subject ?? $defaultSubject;
    }

    protected function brandedContent(string $markdown, array $with = []): Content
    {
        // The theme takes the organizer's color (resources/views/vendor/mail/html/themes/participant).
        $this->theme = 'participant';

        return new Content(
            markdown: $markdown,
            with: [
                ...$with,
                'branding' => app(EventEmailBrandingService::class)->forEvent($this->event, $this->organizer),
                'organizerMessage' => $this->customization()->message,
            ],
        );
    }
}
