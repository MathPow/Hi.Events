<?php

namespace HiEvents\Mail\Order;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\Mail\BaseMail;
use HiEvents\Mail\Concerns\HasEventBranding;
use HiEvents\Values\MoneyValue;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * @uses /backend/resources/views/emails/orders/order-refunded.blade.php
 */
class OrderRefunded extends BaseMail
{
    use HasEventBranding;

    public function __construct(
        private readonly OrderDomainObject        $order,
        private readonly EventDomainObject        $event,
        private readonly OrganizerDomainObject    $organizer,
        private readonly EventSettingDomainObject $eventSettings,
        private readonly MoneyValue               $refundAmount,
    )
    {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: $this->eventSettings->getSupportEmail(),
            subject: $this->brandedSubject(__('You\'ve received a refund')),
        );
    }

    public function content(): Content
    {
        return $this->brandedContent('emails.orders.order-refunded', [
            'event' => $this->event,
            'order' => $this->order,
            'organizer' => $this->organizer,
            'eventSettings' => $this->eventSettings,
            'refundAmount' => $this->refundAmount,
        ]);
    }

    protected function emailTemplateType(): EmailTemplateType
    {
        return EmailTemplateType::ORDER_REFUNDED;
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
