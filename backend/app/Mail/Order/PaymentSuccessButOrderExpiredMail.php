<?php

namespace HiEvents\Mail\Order;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\Mail\BaseMail;
use HiEvents\Mail\Concerns\HasEventBranding;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * @uses /backend/resources/views/emails/orders/payment-success-but-order-expired.blade.php
 */
class PaymentSuccessButOrderExpiredMail extends BaseMail
{
    use HasEventBranding;

    public function __construct(
        private readonly OrderDomainObject        $order,
        private readonly EventDomainObject        $event,
        private readonly EventSettingDomainObject $eventSettings,
        private readonly OrganizerDomainObject    $organizer,
    )
    {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: $this->eventSettings->getSupportEmail(),
            subject: $this->brandedSubject(__('We were unable to process your order')),
        );
    }

    public function content(): Content
    {
        return $this->brandedContent('emails.orders.payment-success-but-order-expired', [
            'event' => $this->event,
            'order' => $this->order,
            'organizer' => $this->organizer,
            'eventSettings' => $this->eventSettings,
        ]);
    }

    protected function emailTemplateType(): EmailTemplateType
    {
        return EmailTemplateType::PAYMENT_AFTER_EXPIRY;
    }

    protected function participantFirstName(): ?string
    {
        return $this->order->getFirstName();
    }

    protected function participantLastName(): ?string
    {
        return $this->order->getLastName();
    }
}
