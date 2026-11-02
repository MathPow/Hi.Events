<?php

namespace HiEvents\Mail\Organizer;

use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\OrganizerMessageDomainObject;
use HiEvents\Mail\BaseMail;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * The organizer's answer to a message sent with « Contacter », written in their inbox.
 *
 * @uses /backend/resources/views/emails/organizer/contact-reply.blade.php
 */
class OrganizerContactReplyEmail extends BaseMail
{
    public function __construct(
        private readonly OrganizerDomainObject        $organizer,
        private readonly OrganizerMessageDomainObject $message,
        private readonly string                       $reply,
    )
    {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: $this->organizer->getEmail()
                ? [new Address($this->organizer->getEmail(), $this->organizer->getName())]
                : [],
            subject: __('Response from :organizerName', ['organizerName' => $this->organizer->getName()]),
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.organizer.contact-reply',
            with: [
                'organizerName' => $this->organizer->getName(),
                'senderName' => $this->message->getSenderName(),
                'reply' => $this->reply,
                'originalMessage' => $this->message->getMessage(),
            ],
        );
    }
}
