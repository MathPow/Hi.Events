<?php

namespace HiEvents\Mail\EventChange;

use HiEvents\DomainObjects\EventCancellationDomainObject;
use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\EventSettingDomainObject;
use HiEvents\DomainObjects\OrganizerDomainObject;
use HiEvents\DomainObjects\Status\EventChangeRefundStatus;
use HiEvents\Helper\Currency;
use HiEvents\Mail\BaseMail;
use HiEvents\Services\Domain\Mail\EventEmailBrandingService;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * « Annuler l'événement »: the organizer's message, and to a buyer what happens to their money.
 *
 * @uses /backend/resources/views/emails/event-change/cancelled.blade.php
 */
class EventCancelledMail extends BaseMail
{
    use EventChangeDates;

    public function __construct(
        public readonly EventDomainObject             $event,
        public readonly OrganizerDomainObject         $organizer,
        public readonly EventSettingDomainObject      $eventSettings,
        public readonly EventCancellationDomainObject $cancellation,
        public readonly ?string                       $firstName,
        public readonly ?EventChangeRefundStatus      $refundStatus = null,
        public readonly float                         $refundAmount = 0.0,
    )
    {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: $this->eventSettings->getSupportEmail(),
            subject: __(':event is cancelled', ['event' => $this->event->getTitle()]),
        );
    }

    public function content(): Content
    {
        $this->theme = 'participant';

        return new Content(
            markdown: 'emails.event-change.cancelled',
            with: [
                'event' => $this->event,
                'eventSettings' => $this->eventSettings,
                'branding' => app(EventEmailBrandingService::class)->forEvent($this->event, $this->organizer),
                'organizerMessage' => $this->messageHtml($this->cancellation->getMessage()),
                'firstName' => $this->firstName,
                'refundLine' => $this->refundLine(),
                'organizerName' => $this->organizer->getName() ?: config('app.name'),
            ],
        );
    }

    private function refundLine(): ?string
    {
        $amount = Currency::format($this->refundAmount, $this->event->getCurrency());

        return match ($this->refundStatus) {
            EventChangeRefundStatus::REFUNDED => __('You will be refunded :amount on the card you paid with. It usually shows up within 5 to 10 business days.', ['amount' => $amount]),
            EventChangeRefundStatus::MANUAL_REFUND_REQUIRED,
            EventChangeRefundStatus::FAILED => __('The organizer will contact you to refund your :amount.', ['amount' => $amount]),
            default => null,
        };
    }
}
