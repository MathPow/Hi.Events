<?php

namespace HiEvents\Services\Application\Handlers\EventChange\DTO;

use HiEvents\DataTransferObjects\BaseDataObject;

/**
 * The card « Mauvaise météo ? »: who would hear about a change, the last postponements, the
 * cancellation and what became of each order.
 */
class EventChangeStatusDTO extends BaseDataObject
{
    /**
     * @param array{orders: int, recipients: int, paid_online_orders: int, paid_offline_orders: int, unpaid_orders: int} $audience
     * @param array<int, array<string, mixed>> $date_changes
     * @param array<string, mixed>|null $cancellation with the number of its orders in each EventChangeRefundStatus
     * @param array<int, array<string, mixed>> $refunds_to_check
     */
    public function __construct(
        public readonly ?string $cancelled_at,
        public readonly array   $audience,
        public readonly array   $date_changes,
        public readonly ?array  $cancellation,
        public readonly array   $refunds_to_check,
    )
    {
    }
}
