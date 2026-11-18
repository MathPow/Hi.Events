<?php

namespace HiEvents\Mail\EventChange;

use HiEvents\DomainObjects\EventDateChangeDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Mail\BaseMail;
use HiEvents\Services\Domain\Mail\EventEmailBrandingService;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * « Reporter l'événement »: the organizer's message and the new date, to a buyer (with the refund
 * button when the order was paid online and refunds are offered) or to a participant.
 *
 * @uses /backend/resources/views/emails/event-change/postponed.blade.php
 */
class EventPostponedMail extends BaseMail
{
    use EventChangeDates;

    public function __construct(
        public readonly EventDomainObject           $event,
        public readonly OrganizerDomainObject       $organizer,
        public readonly EventSettingDomainObject    $eventSettings,
        public readonly EventDateChangeDomainObject $dateChange,
        public readonly ?string                     $firstName,
        public readonly ?string                     $refundUrl,
    )
    {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: $this->eventSettings->getSupportEmail(),
            subject: __(':event is postponed', ['event' => $this->event->getTitle()]),
        );
    }

    public function content(): Content
    {
        $this->theme = 'participant';
        $timezone = $this->event->getTimezone();

        return new Content(
            markdown: 'emails.event-change.postponed',
            with: [
                'event' => $this->event,
                'eventSettings' => $this->eventSettings,
                'branding' => app(EventEmailBrandingService::class)->forEvent($this->event, $this->organizer),
                'organizerMessage' => $this->messageHtml($this->dateChange->getMessage()),
                'firstName' => $this->firstName,
                'newDate' => $this->formatEventDate($this->dateChange->getNewStartDate(), $timezone),
                'refundUrl' => $this->refundUrl,
                'refundDeadline' => $this->formatEventDate($this->dateChange->getRefundDeadline(), $timezone, capitalize: false),
                'eventUrl' => $this->event->getEventUrl(),
                'organizerName' => $this->organizer->getName() ?: config('app.name'),
            ],
        );
    }
}
