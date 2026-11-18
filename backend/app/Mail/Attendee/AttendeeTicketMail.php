<?php

namespace HiEvents\Mail\Attendee;

use HiEvents\Services\Domain\Waiver\PendingSignatureService;
use Carbon\Carbon;
use HiEvents\DomainObjects\AttendeeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Helper\StringHelper;
use HiEvents\Helper\Url;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\Mail\BaseMail;
use HiEvents\Mail\Concerns\HasEventBranding;
use HiEvents\Services\Domain\Attendee\GenerateAttendeeTicketPDFService;
use HiEvents\DomainObjects\DocumentSignatureDomainObject;
use HiEvents\Repository\Interfaces\DocumentSignatureRepositoryInterface;
use HiEvents\Services\Domain\Document\DocumentPdfService;
use HiEvents\Services\Domain\Event\RouteFile\EventRouteFileService;
use HiEvents\DomainObjects\EventRouteFileDomainObject;
use HiEvents\Services\Domain\Email\DTO\RenderedEmailTemplateDTO;
use HiEvents\Services\Infrastructure\QrCode\QrCodeImageService;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Spatie\IcalendarGenerator\Components\Calendar;
use Spatie\IcalendarGenerator\Components\Event;

/**
 * @uses /backend/resources/views/emails/orders/attendee-ticket.blade.php
 */
class AttendeeTicketMail extends BaseMail
{
    use HasEventBranding;

    private readonly ?RenderedEmailTemplateDTO $renderedTemplate;

    /**
     * @param Collection<int, AttendeeDomainObject>|null $additionalAttendees Other tickets from the
     *        same order addressed to the same person, so a buyer who takes three tickets under one
     *        email address receives all three QR codes instead of only the first.
     */
    public function __construct(
        private readonly OrderDomainObject        $order,
        private readonly AttendeeDomainObject     $attendee,
        private readonly EventDomainObject        $event,
        private readonly EventSettingDomainObject $eventSettings,
        private readonly OrganizerDomainObject    $organizer,
        ?RenderedEmailTemplateDTO                 $renderedTemplate = null,
        private readonly ?Collection              $additionalAttendees = null,
    )
    {
        parent::__construct();
        $this->renderedTemplate = $renderedTemplate;
    }

    /**
     * @return Collection<int, AttendeeDomainObject>
     */
    private function allAttendees(): Collection
    {
        return collect([$this->attendee])->merge($this->additionalAttendees ?? []);
    }

    public function envelope(): Envelope
    {
        $ticketCount = $this->allAttendees()->count();

        $subject = $this->renderedTemplate?->subject ?? trans_choice(
            '{1} 🎟️ Your Ticket for :event|[2,*] 🎟️ Your :count Tickets for :event',
            $ticketCount,
            [
                'count' => $ticketCount,
                'event' => Str::limit($this->event->getTitle(), 50),
            ]
        );

        return new Envelope(
            replyTo: $this->eventSettings->getSupportEmail(),
            subject: $subject,
        );
    }

    public function content(): Content
    {
        if ($this->renderedTemplate) {
            return $this->brandedContent('emails.custom-template', [
                'renderedBody' => $this->renderedTemplate->body,
                'renderedCta' => $this->renderedTemplate->cta,
                'eventSettings' => $this->eventSettings,
                'signatureLinks' => $this->signatureLinks(),
                'routeFiles' => $this->routeFiles(),
            ]);
        }

        $qrCodeImageService = app(QrCodeImageService::class);

        $tickets = $this->allAttendees()->map(fn(AttendeeDomainObject $attendee) => [
            'attendee' => $attendee,
            'qrCode' => $qrCodeImageService->renderPng($attendee->getPublicId()),
            'ticketUrl' => sprintf(
                Url::getFrontEndUrlFromConfig(Url::ATTENDEE_TICKET),
                $this->event->getId(),
                $attendee->getShortId(),
            ),
            'signUrl' => $this->signUrl($attendee),
        ]);

        return $this->brandedContent('emails.orders.attendee-ticket', [
            'event' => $this->event,
            'attendee' => $this->attendee,
            'eventSettings' => $this->eventSettings,
            'organizer' => $this->organizer,
            'order' => $this->order,
            'tickets' => $tickets,
            'routeFiles' => $this->routeFiles(),
            'ticketUrl' => sprintf(
                Url::getFrontEndUrlFromConfig(Url::ATTENDEE_TICKET),
                $this->event->getId(),
                $this->attendee->getShortId(),
            )
        ]);
    }

    /**
     * The link to the participant's ticket page, where they sign what they still have to; null
     * when nothing is left to sign.
     */
    private function signUrl(AttendeeDomainObject $attendee): ?string
    {
        if (!app(PendingSignatureService::class)->hasPending($attendee, $this->eventSettings)) {
            return null;
        }

        return sprintf(
            Url::getFrontEndUrlFromConfig(Url::ATTENDEE_TICKET),
            $this->event->getId(),
            $attendee->getShortId(),
        ) . '#signer';
    }

    /**
     * The event's GPX courses, a download link each.
     *
     * @return Collection<int, EventRouteFileDomainObject>
     */
    private function routeFiles(): Collection
    {
        return app(EventRouteFileService::class)->forEvent($this->event->getId());
    }

    /**
     * @return array<int, array{name: string, url: string}>
     */
    private function signatureLinks(): array
    {
        return $this->allAttendees()
            ->map(fn(AttendeeDomainObject $attendee) => ['name' => $attendee->getFullName(), 'url' => $this->signUrl($attendee)])
            ->filter(fn(array $link) => $link['url'] !== null)
            ->values()
            ->all();
    }

    protected function emailTemplateType(): EmailTemplateType
    {
        return EmailTemplateType::ATTENDEE_TICKET;
    }

    protected function participantFirstName(): ?string
    {
        return $this->attendee->getFirstName();
    }

    public function attachments(): array
    {
        $startDateTime = Carbon::parse($this->event->getStartDate(), 'UTC')->setTimezone($this->event->getTimezone());
        $endDateTime = $this->event->getEndDate() ? Carbon::parse($this->event->getEndDate(), 'UTC')->setTimezone($this->event->getTimezone()) : null;

        $event = Event::create()
            ->name($this->event->getTitle())
            ->uniqueIdentifier('event-' . $this->attendee->getId())
            ->startsAt($startDateTime)
            ->url($this->event->getEventUrl())
            ->organizer($this->organizer->getEmail(), $this->organizer->getName());

        if ($this->event->getDescription()) {
            $event->description(StringHelper::previewFromHtml($this->event->getDescription()));
        }

        if ($this->eventSettings->getLocationDetails()) {
            $event->address($this->eventSettings->getAddressString());
        }

        if ($endDateTime) {
            $event->endsAt($endDateTime);
        }

        $calendar = Calendar::create()
            ->event($event)
            ->get();

        $attendees = $this->allAttendees();

        // The PDF carries the QR codes too, so a custom email template (which we must not rewrite)
        // still gets the buyer a scannable ticket.
        $ticketPdf = app(GenerateAttendeeTicketPDFService::class)->generatePdf(
            attendees: $attendees,
            order: $this->order,
            event: $this->event,
            eventSettings: $this->eventSettings,
            organizer: $this->organizer,
        );

        return [
            Attachment::fromData(static fn() => $ticketPdf, $this->ticketPdfFilename($attendees->count()))
                ->withMime('application/pdf'),

            Attachment::fromData(static fn() => $calendar, 'event.ics')
                ->withMime('text/calendar'),

            ...$this->documentAttachments($attendees),
        ];
    }

    /**
     * Each attendee's copies of the organizer's documents: signed online, or to print and bring.
     *
     * @param Collection<int, AttendeeDomainObject> $attendees
     * @return Attachment[]
     */
    private function documentAttachments(Collection $attendees): array
    {
        $copies = app(DocumentSignatureRepositoryInterface::class)->findWhereIn(
            'attendee_id',
            $attendees->map(fn(AttendeeDomainObject $attendee) => $attendee->getId())->all(),
        );

        if ($copies->isEmpty()) {
            return [];
        }

        $pdfService = app(DocumentPdfService::class);

        return $copies
            ->sortBy(fn(DocumentSignatureDomainObject $copy) => $copy->getId())
            ->map(function (DocumentSignatureDomainObject $copy) use ($pdfService) {
                $pdf = $pdfService->copy($copy, $this->event->getTimezone());

                return Attachment::fromData(
                    static fn() => $pdf,
                    $pdfService->filename($copy->getTitle(), $copy->getAutoValues()['participant_name'] ?? null),
                )->withMime('application/pdf');
            })
            ->values()
            ->all();
    }

    private function ticketPdfFilename(int $ticketCount): string
    {
        $name = Str::slug($this->event->getTitle()) ?: 'event';

        return $ticketCount > 1
            ? sprintf('%s-tickets.pdf', $name)
            : sprintf('%s-ticket.pdf', $name);
    }
}
