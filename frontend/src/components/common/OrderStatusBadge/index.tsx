import {BadgeVariant} from "@mantine/core";
import {Order} from "../../../types.ts";
import {t} from "@lingui/macro";
import {StatusTag, StatusTone} from "../StatusTag";

const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        'COMPLETED': t`Completed`,
        'CANCELLED': t`Cancelled`,
        'AWAITING_PAYMENT': t`Awaiting Payment`,
        'AWAITING_OFFLINE_PAYMENT': t`Awaiting offline payment`,
        'PAYMENT_RECEIVED': t`Payment Received`,
        'NO_PAYMENT_REQUIRED': t`No Payment Required`,
        'PAYMENT_FAILED': t`Payment Failed`,
        'REFUNDED': t`Refunded`,
        'PARTIALLY_REFUNDED': t`Partially Refunded`,
        'REFUND_PENDING': t`Refund Pending`,
    };
    return labels[status] || status.replace('_', ' ');
};

// Same colors as « Commandes récentes » on the organizer dashboard.
export const getOrderStatusTone = (status: string): StatusTone => {
    switch (status) {
        case 'AWAITING_PAYMENT':
        case 'AWAITING_OFFLINE_PAYMENT':
        case 'REFUND_PENDING':
        case 'PARTIALLY_REFUNDED':
            return 'waiting';
        case 'PAYMENT_FAILED':
        case 'REFUND_FAILED':
            return 'problem';
        case 'CANCELLED':
        case 'REFUNDED':
            return 'neutral';
        default:
            return 'ok';
    }
};

// The variant is kept for older callers: every status is now a tag.
export const OrderStatusBadge = ({order}: { order: Order, variant?: BadgeVariant }) => {
    let status: string;

    if (order.status === 'CANCELLED' || order.status === 'AWAITING_OFFLINE_PAYMENT') {
        status = order.status;
    } else if (order.refund_status) {
        status = order.refund_status;
    } else if (order.payment_status && order.payment_status !== 'PAYMENT_RECEIVED'
        && order.payment_status !== 'NO_PAYMENT_REQUIRED') {
        status = order.payment_status;
    } else {
        status = order.status;
    }

    return <StatusTag tone={getOrderStatusTone(status)}>{getStatusLabel(status)}</StatusTag>;
};
