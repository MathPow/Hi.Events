import {t} from "@lingui/macro";
import {Event, EventLifecycleStatus, EventStatus, IdParam, Order, ProductType, QueryFilterOperator} from "../../../../types.ts";
import {useGetOrganizerMessages} from "../../../../queries/useGetOrganizerMessages.ts";
import {useGetEventOrders} from "../../../../queries/useGetEventOrders.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {getProductsFromEvent} from "../../../../utilites/helpers.ts";
import {ALMOST_FULL_RATIO} from "../../../../utilites/eventSales.ts";
import {DashboardNotification} from "../../organizer/OrganizerDashboard/dashboardData.ts";

const offlinePaymentsFilter = {
    pageNumber: 1,
    perPage: 20,
    sortBy: 'created_at',
    sortDirection: 'desc' as const,
    filterFields: {
        status: {operator: QueryFilterOperator.Equals, value: 'AWAITING_OFFLINE_PAYMENT'},
    },
};

const ticketCount = (order: Order) =>
    (order.order_items ?? []).reduce((total, item) => total + (item.quantity ?? 0), 0);

// Each ticket's sales against its limit (null: no limit on one of its prices).
const ticketCapacities = (event: Event) => (getProductsFromEvent(event) ?? [])
    .filter((product) => product.product_type === ProductType.Ticket)
    .map((product) => {
        const prices = product.prices?.length
            ? product.prices
            : [{quantity_sold: product.quantity_sold, initial_quantity_available: product.initial_quantity_available}];
        const sold = prices.reduce((total, price) => total + (price.quantity_sold ?? 0), 0);
        const capacity = prices.some((price) => price.initial_quantity_available === null || price.initial_quantity_available === undefined)
            ? null
            : prices.reduce((total, price) => total + (price.initial_quantity_available ?? 0), 0);

        return {product, sold, capacity: capacity || null};
    });

/**
 * The event's notifications, like the organizer dashboard's but for this event only: the messages
 * written from its page, its offline payments to confirm and its tickets about to sell out.
 */
export const useEventNotifications = (eventId: IdParam, event: Event | undefined) => {
    const organizerId = event?.organizer?.id ?? event?.organizer_id;
    const messagesQuery = useGetOrganizerMessages(organizerId, 1, false);
    const offlineOrdersQuery = useGetEventOrders(eventId, offlinePaymentsFilter);

    if (!event) {
        return {notifications: [] as DashboardNotification[], toHandleCount: 0};
    }

    const messages: DashboardNotification[] = (messagesQuery.data?.data ?? [])
        .filter((message) => message.event_id === event.id)
        .map((message) => {
            const senderName = message.sender_name;
            const text = message.message;

            return {
                id: `message-${message.id}`,
                kind: 'message',
                title: t`New message`,
                body: t`${senderName}: “${text}”`,
                date: message.created_at,
                unread: !message.read_at,
                toHandle: !message.read_at && !message.replied_at,
                action: {
                    label: t`Reply`,
                    link: `/manage/organizer/${organizerId}/messages?message=${message.id}&reply=1`,
                },
            };
        });

    const payments: DashboardNotification[] = (offlineOrdersQuery.data?.data ?? []).map((order) => {
        const tickets = ticketCount(order);

        return {
            id: `payment-${order.id}`,
            kind: 'payment',
            title: t`Payment to confirm`,
            body: t`Order #${order.public_id} · ${tickets} tickets · ${formatCurrency(order.total_gross, order.currency)}`,
            date: order.created_at,
            unread: true,
            toHandle: true,
            action: {label: t`View the order`, link: `/manage/event/${event.id}/orders#order-${order.id}`},
        };
    });

    const isSelling = event.status === EventStatus.LIVE && event.lifecycle_status !== EventLifecycleStatus.ENDED;
    const almostFull: DashboardNotification[] = isSelling ? ticketCapacities(event).flatMap(({product, sold, capacity}) => {
        if (!capacity || sold / capacity < ALMOST_FULL_RATIO) {
            return [];
        }
        const productName = product.title;

        return [{
            id: `almost-full-${product.id}`,
            kind: 'almost_full' as const,
            title: sold >= capacity ? t`Sold out` : t`Almost full`,
            body: t`${productName}: ${sold} sold out of ${capacity}.`,
            unread: true,
            toHandle: true,
            action: {label: t`Add tickets`, link: `/manage/event/${event.id}/products`},
        }];
    }) : [];

    const byDate = (a: DashboardNotification, b: DashboardNotification) => (b.date ?? '').localeCompare(a.date ?? '');
    const notifications = [
        ...messages.filter((item) => item.toHandle).sort(byDate),
        ...payments.sort(byDate),
        ...almostFull,
        ...messages.filter((item) => !item.toHandle).sort(byDate),
    ];

    return {notifications, toHandleCount: notifications.filter((item) => item.toHandle).length};
};
