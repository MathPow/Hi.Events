import {plural, t} from "@lingui/macro";
import {Order} from "../types.ts";

// An order in a line, on the organizer's Commandes page and the event's dashboard.

export type OrderStatusTone = 'done' | 'waiting' | 'neutral';

export const orderStatus = (order: Order): { label: string, tone: OrderStatusTone } => {
    if (order.status === 'CANCELLED') {
        return {label: t({message: 'Cancelled', context: 'order status'}), tone: 'neutral'};
    }
    if (order.refund_status === 'REFUNDED') {
        return {label: t({message: 'Refunded', context: 'order status'}), tone: 'neutral'};
    }
    if (order.refund_status === 'PARTIALLY_REFUNDED') {
        return {label: t({message: 'Partially Refunded', context: 'order status'}), tone: 'waiting'};
    }
    if (order.refund_status === 'REFUND_PENDING') {
        return {label: t`Refund pending`, tone: 'waiting'};
    }
    if (order.status === 'AWAITING_OFFLINE_PAYMENT' || order.payment_status === 'AWAITING_PAYMENT') {
        return {label: t`Pending`, tone: 'waiting'};
    }
    return {label: t({message: 'Completed', context: 'order status'}), tone: 'done'};
};

// « 2 billets · 1 casquette »: the tickets counted together, each other product by its name.
export const orderContents = (order: Order) => {
    const items = order.order_items ?? [];
    const tickets = items
        .filter(item => (item.product_type ?? 'TICKET') === 'TICKET')
        .reduce((total, item) => total + (item.quantity ?? 0), 0);
    const parts = tickets > 0 ? [plural(tickets, {one: '# ticket', other: '# tickets'})] : [];
    items
        .filter(item => item.product_type && item.product_type !== 'TICKET')
        .forEach(item => parts.push(`${item.quantity} × ${item.item_name}`));

    return parts.join(' · ');
};
