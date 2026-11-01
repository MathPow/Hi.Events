<?php

declare(strict_types=1);

namespace HiEvents\Services\Domain\Mail;

use Carbon\Carbon;
use HiEvents\DomainObjects\EmailTemplateDomainObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Helper\AddressHelper;
use HiEvents\Repository\Interfaces\EmailTemplateRepositoryInterface;
use HiEvents\Services\Domain\Mail\DTO\EmailCustomizationDTO;
use HiEvents\Services\Infrastructure\Email\LiquidTemplateRenderer;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * For the participant emails that keep their content (all but the order confirmation and the
 * ticket), the subject and message the organizer wrote on « Courriels », for this event or for all
 * their events.
 */
class ParticipantEmailService
{
    public function __construct(
        private readonly EmailTemplateRepositoryInterface $templateRepository,
        private readonly LiquidTemplateRenderer           $liquid,
        private readonly LoggerInterface                  $logger,
    )
    {
    }

    public function customize(
        EmailTemplateType     $type,
        EventDomainObject     $event,
        OrganizerDomainObject $organizer,
        ?string               $firstName = null,
        ?string               $lastName = null,
    ): EmailCustomizationDTO
    {
        if ($type->hasFullEditor()) {
            return new EmailCustomizationDTO();
        }

        $template = $this->templateRepository->findByTypeWithFallback(
            type: $type,
            accountId: $organizer->getAccountId(),
            eventId: $event->getId() ?: null,
            organizerId: $organizer->getId(),
        );

        if ($template === null) {
            return new EmailCustomizationDTO();
        }

        $context = $this->context($event, $organizer, $firstName, $lastName);

        return new EmailCustomizationDTO(
            subject: $this->renderSubject($template, $context),
            message: $this->renderMessage($template, $context),
        );
    }

    /** The automatic info of the subject and the message, the same for every email. */
    public function context(EventDomainObject $event, OrganizerDomainObject $organizer, ?string $firstName, ?string $lastName): array
    {
        $start = $event->getStartDate()
            ? Carbon::parse($event->getStartDate(), 'UTC')->setTimezone($event->getTimezone() ?: 'UTC')->locale(app()->getLocale())
            : null;
        $settings = $event->getEventSettings();

        return [
            'participant' => [
                'first_name' => $firstName ?? '',
                'last_name' => $lastName ?? '',
            ],
            'event' => [
                'title' => $event->getTitle() ?? '',
                'date' => $start?->isoFormat('LL') ?? '',
                'time' => $start?->isoFormat('LT') ?? '',
                'full_address' => AddressHelper::formatAddress($settings?->getLocationDetails()),
            ],
            'organizer' => [
                'name' => $organizer->getName() ?? '',
                'email' => $organizer->getEmail() ?? '',
            ],
        ];
    }

    private function renderSubject(EmailTemplateDomainObject $template, array $context): ?string
    {
        $subject = trim((string)$template->getSubject());
        if ($subject === '') {
            return null;
        }

        try {
            $subject = trim(preg_replace('/\s+/u', ' ', strip_tags($this->liquid->render($subject, $context))));
        } catch (Throwable $exception) {
            $this->logger->warning('Participant email: the custom subject could not be rendered', [
                'template_id' => $template->getId(),
                'exception' => $exception->getMessage(),
            ]);
            return null;
        }

        return $subject !== '' ? $subject : null;
    }

    private function renderMessage(EmailTemplateDomainObject $template, array $context): ?string
    {
        $body = (string)$template->getBody();
        if (trim(strip_tags($body)) === '') {
            return null;
        }

        try {
            // The names come from the buyers: escaped, since the message is HTML.
            $html = $this->liquid->render($body, $this->escape($context));
        } catch (Throwable $exception) {
            $this->logger->warning('Participant email: the custom message could not be rendered', [
                'template_id' => $template->getId(),
                'exception' => $exception->getMessage(),
            ]);
            return null;
        }

        return trim(strip_tags($html)) !== '' ? $html : null;
    }

    private function escape(array $context): array
    {
        array_walk_recursive($context, function (&$value) {
            if (is_string($value)) {
                $value = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
            }
        });

        return $context;
    }
}
