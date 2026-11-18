<?php

namespace HiEvents\Services\Application\Handlers\EventChange\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

/**
 * What the refund page shows. refund_method: ONLINE (back on the card), OFFLINE (the organizer
 * refunds by hand) or NONE (nothing was paid). outcome: what was done, once the order was cancelled
 * through this link.
 */
class RefundRequestViewDTO extends BaseDataObject
{
    public function __construct(
        public readonly string  $event_title,
        public readonly string  $event_start_date,
        public readonly ?string $event_end_date,
        public readonly string  $event_timezone,
        public readonly string  $old_start_date,
        public readonly ?string $organizer_name,
        public readonly ?string $support_email,
        public readonly string  $order_public_id,
        public readonly ?string $buyer_first_name,
        public readonly ?string $buyer_last_name,
        public readonly float   $total_gross,
        public readonly float   $refundable_amount,
        public readonly string  $currency,
        public readonly string  $refund_method,
        public readonly ?string $refund_deadline,
        public readonly ?string $refusal,
        public readonly ?string $refusal_message,
        public readonly ?string $outcome,
    )
    {
    }
}
