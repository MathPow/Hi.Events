<?php

namespace HiEvents\Mail\Order;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\Mail\BaseMail;
use HiEvents\Mail\Concerns\HasEventBranding;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * @uses /backend/resources/views/emails/orders/order-details-changed.blade.php
 */
class OrderDetailsChangedMail extends BaseMail
{
    use HasEventBranding;

    public function __construct(
        private readonly EventDomainObject $event,
        private readonly OrganizerDomainObject $organizer,
        private readonly EventSettingDomainObject $eventSettings,
        private readonly array $changedFields,
    ) {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: $this->eventSettings->getSupportEmail(),
            subject: $this->brandedSubject(__('Your Order Details Have Been Changed')),
        );
    }

    public function content(): Content
    {
        return $this->brandedContent('emails.orders.order-details-changed', [
            'event' => $this->event,
            'organizer' => $this->organizer,
            'eventSettings' => $this->eventSettings,
            'changedFields' => $this->changedFields,
        ]);
    }

    protected function emailTemplateType(): EmailTemplateType
    {
        return EmailTemplateType::ORDER_DETAILS_CHANGED;
    }
}
