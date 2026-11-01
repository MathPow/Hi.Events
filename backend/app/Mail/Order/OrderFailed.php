<?php

namespace HiEvents\Mail\Order;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Helper\Url;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\Mail\BaseMail;
use HiEvents\Mail\Concerns\HasEventBranding;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * @uses /backend/resources/views/emails/orders/order-failed.blade.php
 */
class OrderFailed extends BaseMail
{
    use HasEventBranding;

    public function __construct(
        private readonly OrderDomainObject        $order,
        private readonly EventDomainObject        $event,
        private readonly OrganizerDomainObject    $organizer,
        private readonly EventSettingDomainObject $eventSettings,
    )
    {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: $this->eventSettings->getSupportEmail(),
            subject: $this->brandedSubject(__('Your order wasn\'t successful')),
        );
    }

    public function content(): Content
    {
        return $this->brandedContent('emails.orders.order-failed', [
            'event' => $this->event,
            'order' => $this->order,
            'organizer' => $this->organizer,
            'eventSettings' => $this->eventSettings,
            'eventUrl' => sprintf(
                Url::getFrontEndUrlFromConfig(Url::EVENT_HOMEPAGE),
                $this->event->getId(),
                $this->event->getSlug(),
            )
        ]);
    }

    protected function emailTemplateType(): EmailTemplateType
    {
        return EmailTemplateType::ORDER_FAILED;
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
