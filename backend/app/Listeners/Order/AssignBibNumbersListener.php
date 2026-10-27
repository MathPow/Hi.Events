<?php

namespace HiEvents\Listeners\Order;

use HiEvents\Events\OrderStatusChangedEvent;
use HiEvents\Services\Domain\Attendee\BibNumberService;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * A confirmed order's attendees get their bib numbers, whatever the payment
 * (free, card, marked as paid, door sale). Run right away rather than queued,
 * for the ticket email that follows to show them.
 */
class AssignBibNumbersListener
{
    public function __construct(
        private readonly BibNumberService $bibNumberService,
    )
    {
    }

    public function handle(OrderStatusChangedEvent $event): void
    {
        if (!$event->order->isOrderCompleted()) {
            return;
        }

        // A bib must never cost a sale: the organizer can assign it later from the settings.
        try {
            $this->bibNumberService->assignForOrder($event->order);
        } catch (Throwable $exception) {
            Log::error('Could not assign bib numbers', [
                'order_id' => $event->order->getId(),
                'exception' => $exception->getMessage(),
            ]);
        }
    }
}
