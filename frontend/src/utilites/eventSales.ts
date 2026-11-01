import {t} from "@lingui/macro";
import {Event, EventLifecycleStatus, EventStatus, ProductType} from "../types.ts";

// Tickets sold out of the tickets put on sale, and the sale status shown on the organizer's
// event cards (dashboard and events page).

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

export type EventSaleStatus = 'draft' | 'on_sale' | 'almost_full' | 'sold_out' | 'ended' | 'archived';

export const getEventSaleStatus = (event: Event, {sold, capacity}: TicketCapacity): EventSaleStatus => {
    if (event.status === EventStatus.ARCHIVED) {
        return 'archived';
    }
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

export const saleStatusLabel = (status: EventSaleStatus) => {
    switch (status) {
        case 'draft':
            return t`Draft`;
        case 'almost_full':
            return t`Almost full`;
        case 'sold_out':
            return t`Sold out`;
        case 'ended':
            return t`Ended`;
        case 'archived':
            return t`Archived`;
        default:
            return t`On Sale`;
    }
};
