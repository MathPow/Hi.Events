<?php

namespace HiEvents\Mail\EventChange;

use HiEvents\DomainObjects\EventDomainObject;
use HiEvents\DomainObjects\OrderDomainObject;
use HiEvents\Helper\Currency;
use HiEvents\Helper\Url;
use HiEvents\Mail\BaseMail;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Support\Str;

/**
 * To the organizer: a participant of a postponed event cancelled an order that was not paid online,
 * it has to be refunded by hand.
 *
 * @uses /backend/resources/views/emails/event-change/manual-refund-required.blade.php
 */
class ManualRefundRequiredMail extends BaseMail
{
    public function __construct(
        public readonly OrderDomainObject $order,
        public readonly EventDomainObject $event,
        public readonly float             $amount,
    )
    {
        parent::__construct();
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: __('Refund to make by hand: order :number for :event', [
                'number' => $this->order->getPublicId(),
                'event' => Str::limit($this->event->getTitle(), 75),
            ]),
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.event-change.manual-refund-required',
            with: [
                'order' => $this->order,
                'event' => $this->event,
                'amount' => Currency::format($this->amount, $this->event->getCurrency()),
                'orderUrl' => sprintf(
                    Url::getFrontEndUrlFromConfig(Url::ORGANIZER_ORDER_SUMMARY),
                    $this->event->getId(),
                    $this->order->getId(),
                ),
            ],
        );
    }
}
