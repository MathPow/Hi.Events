import {queryClient} from "./queryClient.ts";
import {GET_EVENT_ORDERS_QUERY_KEY} from "../queries/useGetEventOrders.ts";
import {GET_ORDER_QUERY_KEY} from "../queries/useGetOrder.ts";
import {GET_ATTENDEES_QUERY_KEY} from "../queries/useGetAttendees.ts";
import {GET_ATTENDEE_QUERY_KEY} from "../queries/useGetAttendee.ts";
import {GET_EVENT_QUERY_KEY} from "../queries/useGetEvent.ts";
import {GET_EVENT_STATS_QUERY_KEY} from "../queries/useGetEventStats.ts";

/**
 * An order changed (paid, cancelled, refunded, edited): everything that shows it, its attendees
 * or the places it holds (lists, open panel, « Inscrits » tile, quantities sold) reloads.
 */
export const invalidateOrderViews = () => Promise.all([
    GET_EVENT_ORDERS_QUERY_KEY,
    GET_ORDER_QUERY_KEY,
    GET_ATTENDEES_QUERY_KEY,
    GET_ATTENDEE_QUERY_KEY,
    GET_EVENT_QUERY_KEY,
    GET_EVENT_STATS_QUERY_KEY,
].map(key => queryClient.invalidateQueries({queryKey: [key]})));
