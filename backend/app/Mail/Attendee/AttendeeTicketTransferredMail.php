<?php

namespace HiEvents\Mail\Attendee;

use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Mail\BaseMail;
use HiEvents\Mail\Concerns\HasEventBranding;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * To the previous holder of a ticket given to someone else, and to the buyer when it was not theirs.
 *
 * @uses /backend/resources/views/emails/orders/attendee-ticket-transferred.blade.php
 */
class AttendeeTicketTransferredMail extends BaseMail
{
    use HasEventBranding;

    public function __construct(
        private readonly EventDomainObject        $event,
        private readonly OrganizerDomainObject    $organizer,
        private readonly EventSettingDomainObject $eventSettings,
        private readonly string                   $ticketTitle,
        private readonly string                   $previousHolderName,
        private readonly string                   $newHolderName,
        private readonly bool                     $toBuyer = false,
    )
    {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: $this->eventSettings->getSupportEmail(),
            subject: __('Your ticket for :event has been transferred', ['event' => $this->event->getTitle()]),
        );
    }

    public function content(): Content
    {
        return $this->brandedContent('emails.orders.attendee-ticket-transferred', [
            'event' => $this->event,
            'organizer' => $this->organizer,
            'eventSettings' => $this->eventSettings,
            'ticketTitle' => $this->ticketTitle,
            'previousHolderName' => $this->previousHolderName,
            'newHolderName' => $this->newHolderName,
            'toBuyer' => $this->toBuyer,
        ]);
    }

    /** The organizer's message for a changed ticket is the closest fit. */
    protected function emailTemplateType(): EmailTemplateType
    {
        return EmailTemplateType::ATTENDEE_DETAILS_CHANGED;
    }
}
