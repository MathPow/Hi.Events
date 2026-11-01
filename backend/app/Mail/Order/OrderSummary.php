<?php

namespace HiEvents\Mail\Order;

use Barryvdh\DomPDF\Facade\Pdf;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\InvoiceDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\Helper\Url;
use HiEvents\DomainObjects\Enums\EmailTemplateType;
use HiEvents\Mail\BaseMail;
use HiEvents\Mail\Concerns\HasEventBranding;
use HiEvents\Services\Domain\Email\DTO\RenderedEmailTemplateDTO;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * @uses /backend/resources/views/emails/orders/summary.blade.php
 */
class OrderSummary extends BaseMail
{
    use HasEventBranding;

    private readonly ?RenderedEmailTemplateDTO $renderedTemplate;

    public function __construct(
        private readonly OrderDomainObject        $order,
        private readonly EventDomainObject        $event,
        private readonly OrganizerDomainObject    $organizer,
        private readonly EventSettingDomainObject $eventSettings,
        private readonly ?InvoiceDomainObject     $invoice,
        ?RenderedEmailTemplateDTO                 $renderedTemplate = null,
    )
    {
        $this->renderedTemplate = $renderedTemplate;

        parent::__construct();
    }

    public function envelope(): Envelope
    {
        $subject = $this->renderedTemplate?->subject ?? __('Your order is confirmed') . ' 🎉';

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
            ]);
        }

        return $this->brandedContent('emails.orders.summary', [
            'eventSettings' => $this->eventSettings,
            'event' => $this->event,
            'order' => $this->order,
            'organizer' => $this->organizer,
            'orderUrl' => sprintf(
                Url::getFrontEndUrlFromConfig(Url::ORDER_SUMMARY),
                $this->event->getId(),
                $this->order->getShortId(),
            )
        ]);
    }

    protected function emailTemplateType(): EmailTemplateType
    {
        return EmailTemplateType::ORDER_CONFIRMATION;
    }

    protected function participantFirstName(): ?string
    {
        return $this->order->getFirstName();
    }

    public function attachments(): array
    {
        if ($this->invoice === null) {
            return [];
        }

        $invoice = Pdf::loadView('invoice', [
            'order' => $this->order,
            'event' => $this->event,
            'organizer' => $this->organizer,
            'eventSettings' => $this->eventSettings,
            'invoice' => $this->invoice,
        ]);

        return [
            Attachment::fromData(
                static fn() => $invoice->output(),
                'invoice.pdf',
            )->withMime('application/pdf'),
        ];
    }
}
