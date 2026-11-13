<?php

namespace HiEvents\Services\Application\Handlers\EventChange;

use HiEvents\Services\Application\Handlers\EventChange\DTO\RefundRequestViewDTO;
use HiEvents\Services\Domain\EventChange\DTO\RefundRequestContextDTO;
use HiEvents\Services\Domain\EventChange\Enums\RefundRequestRefusal;
use HiEvents\Services\Domain\EventChange\EventOrderRefundService;

class RefundRequestViewFactory
{
    public function __construct(private readonly EventOrderRefundService $eventOrderRefundService)
    {
    }

    public function make(RefundRequestContextDTO $context, ?RefundRequestRefusal $refusal, ?string $outcome = null): RefundRequestViewDTO
    {
        $order = $context->order;
        $event = $context->event;

        return new RefundRequestViewDTO(
            event_title: $event->getTitle(),
            event_start_date: $event->getStartDate(),
            event_end_date: $event->getEndDate(),
            event_timezone: $event->getTimezone() ?: 'UTC',
            old_start_date: $context->dateChange->getOldStartDate(),
            organizer_name: $event->getOrganizer()?->getName(),
            support_email: $event->getEventSettings()?->getSupportEmail(),
            order_public_id: $order->getPublicId(),
            buyer_first_name: $order->getFirstName(),
            buyer_last_name: $order->getLastName(),
            total_gross: $order->getTotalGross(),
            refundable_amount: $this->eventOrderRefundService->isUnpaid($order) ? 0.0 : $this->eventOrderRefundService->refundableAmount($order),
            currency: $order->getCurrency(),
            refund_method: match (true) {
                $this->eventOrderRefundService->isUnpaid($order) => 'NONE',
                $this->eventOrderRefundService->isPaidOnline($order) => 'ONLINE',
                default => 'OFFLINE',
            },
            refund_deadline: $context->dateChange->getRefundDeadline(),
            refusal: $outcome === null ? $refusal?->name : null,
            refusal_message: $outcome === null ? $refusal?->message() : null,
            outcome: $outcome ?? $context->refund?->getStatus(),
        );
    }
}
