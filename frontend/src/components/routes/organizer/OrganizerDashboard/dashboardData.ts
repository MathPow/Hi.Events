import {useState} from "react";
import {t} from "@lingui/macro";
import {Event, EventLifecycleStatus, EventStatus, IdParam, Order, ProductType, QueryFilterOperator} from "../../../../types.ts";
import {useGetOrganizerMessages, useGetOrganizerUnreadMessagesCount} from "../../../../queries/useGetOrganizerMessages.ts";
import {useGetOrganizerOrders} from "../../../../queries/useGetOrganizerOrders.ts";
import {useMarkAllOrganizerMessagesRead} from "../../../../mutations/useOrganizerMessageMutations.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";

export const ALMOST_FULL_RATIO = 0.9;

export interface TicketCapacity {
    sold: number;
    // Null when at least one ticket has no limit.
    capacity: number | null;
}

// Tickets sold out of the tickets put on sale, from the products loaded with the events list.
export const getTicketCapacity = (event: Event): TicketCapacity => {
    const tickets = (event.products ?? []).filter((product) => product.product_type === ProductType.Ticket);
    let sold = 0;
    let capacity: number | null = tickets.length > 0 ? 0 : null;

    const add = (quantitySold?: number, available?: number | null) => {
        sold += quantitySold ?? 0;
        if (available === null || available === undefined) {
            capacity = null;
        } else if (capacity !== null) {
            capacity += available;
        }
    };

    tickets.forEach((product) => {
        if (product.prices?.length) {
            product.prices.forEach((price) => add(price.quantity_sold, price.initial_quantity_available));
        } else {
            add(product.quantity_sold, product.initial_quantity_available);
        }
    });

    return {sold, capacity: capacity === 0 ? null : capacity};
};

export type EventSaleStatus = 'draft' | 'on_sale' | 'almost_full' | 'sold_out' | 'ended';

export const getEventSaleStatus = (event: Event, {sold, capacity}: TicketCapacity): EventSaleStatus => {
    if (event.status === EventStatus.DRAFT) {
        return 'draft';
    }
    if (event.lifecycle_status === EventLifecycleStatus.ENDED) {
        return 'ended';
    }
    if (capacity !== null && sold >= capacity) {
        return 'sold_out';
    }
    if (capacity !== null && sold / capacity >= ALMOST_FULL_RATIO) {
        return 'almost_full';
    }
    return 'on_sale';
};

export type DashboardNotificationKind = 'message' | 'payment' | 'almost_full';

export interface DashboardNotification {
    id: string;
    kind: DashboardNotificationKind;
    title: string;
    body: string;
    date?: string;
    unread: boolean;
    // Still something to do (the « À régler » tab).
    toHandle: boolean;
    action?: { label: string; link: string };
}

const SEEN_STORAGE_KEY = (organizerId: IdParam) => `dehors-dashboard-seen-${organizerId}`;

const readSeen = (organizerId: IdParam): string[] => {
    try {
        return JSON.parse(localStorage.getItem(SEEN_STORAGE_KEY(organizerId)) ?? '[]');
    } catch {
        return [];
    }
};

const writeSeen = (organizerId: IdParam, ids: string[]) => {
    try {
        localStorage.setItem(SEEN_STORAGE_KEY(organizerId), JSON.stringify(ids.slice(-200)));
    } catch {
        // localStorage unavailable
    }
};

const ticketCount = (order: Order) =>
    (order.order_items ?? []).reduce((total, item) => total + (item.quantity ?? 0), 0);

const offlinePaymentsFilter = {
    pageNumber: 1,
    perPage: 20,
    sortBy: 'created_at',
    sortDirection: 'desc' as const,
    filterFields: {
        status: {operator: QueryFilterOperator.Equals, value: 'AWAITING_OFFLINE_PAYMENT'},
    },
};

// What the dashboard's notifications are made of: the « Contacter » messages, the offline
// payments still to confirm and the events about to sell out. There is no payout or refund
// request data in the ticketing yet.
export const useDashboardNotifications = (organizerId: IdParam, events: Event[] | undefined) => {
    const messagesQuery = useGetOrganizerMessages(organizerId, 1, false);
    const offlineOrdersQuery = useGetOrganizerOrders(organizerId, offlinePaymentsFilter);
    const markAllRead = useMarkAllOrganizerMessagesRead();
    const [seen, setSeen] = useState<string[]>(() => typeof window === 'undefined' ? [] : readSeen(organizerId));

    const messages: DashboardNotification[] = (messagesQuery.data?.data ?? []).map((message) => ({
        id: `message-${message.id}`,
        kind: 'message',
        title: message.event
            ? t`${message.sender_name} wrote about ${message.event.title}`
            : t`${message.sender_name} wrote to you`,
        body: message.message,
        date: message.created_at,
        unread: !message.read_at,
        toHandle: !message.read_at,
        action: {label: t`Read the message`, link: `/manage/organizer/${organizerId}/messages`},
    }));

    const payments: DashboardNotification[] = (offlineOrdersQuery.data?.data ?? []).map((order) => {
        const id = `payment-${order.id}`;
        const tickets = ticketCount(order);

        return {
            id,
            kind: 'payment',
            title: t`Payment to confirm`,
            body: t`Order #${order.public_id} · ${tickets} tickets · ${formatCurrency(order.total_gross, order.currency)}`,
            date: order.created_at,
            unread: !seen.includes(id),
            toHandle: true,
            action: {label: t`View the order`, link: `/manage/event/${order.event_id}/orders#order-${order.id}`},
        };
    });

    const almostFull: DashboardNotification[] = (events ?? []).flatMap((event) => {
        const capacity = getTicketCapacity(event);
        const status = getEventSaleStatus(event, capacity);
        if (status !== 'almost_full' && status !== 'sold_out') {
            return [];
        }
        const id = `${status}-${event.id}-${capacity.sold}`;

        return [{
            id,
            kind: 'almost_full' as const,
            title: status === 'sold_out' ? t`Sold out` : t`Almost full`,
            body: t`${event.title}: ${capacity.sold} tickets sold out of ${capacity.capacity}.`,
            unread: !seen.includes(id),
            toHandle: true,
            action: {label: t`Add tickets`, link: `/manage/event/${event.id}/products`},
        }];
    });

    const byDate = (a: DashboardNotification, b: DashboardNotification) =>
        (b.date ?? '').localeCompare(a.date ?? '');

    const notifications = [
        ...messages.filter((item) => item.unread).sort(byDate),
        ...payments.sort(byDate),
        ...almostFull,
        ...messages.filter((item) => !item.unread).sort(byDate),
    ];

    const markAllAsRead = () => {
        if (messages.some((item) => item.unread)) {
            markAllRead.mutate({organizerId});
        }
        const ids = Array.from(new Set([...seen, ...payments.map((item) => item.id), ...almostFull.map((item) => item.id)]));
        setSeen(ids);
        writeSeen(organizerId, ids);
    };

    return {
        notifications,
        unreadCount: notifications.filter((item) => item.unread).length,
        toHandleCount: notifications.filter((item) => item.toHandle).length,
        isLoading: messagesQuery.isLoading || offlineOrdersQuery.isLoading,
        markAllAsRead,
        isMarkingAllAsRead: markAllRead.isPending,
    };
};

// The counter on « Tableau de bord » in the nav: unread messages and payments to confirm,
// without loading the events on every page.
export const useDashboardAttentionCount = (organizerId: IdParam) => {
    const {data: unreadMessages} = useGetOrganizerUnreadMessagesCount(organizerId);
    const {data: offlineOrders} = useGetOrganizerOrders(organizerId, offlinePaymentsFilter);

    return (unreadMessages ?? 0) + (offlineOrders?.meta?.total ?? 0);
};
