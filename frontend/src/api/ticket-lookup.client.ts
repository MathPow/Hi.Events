import {api} from './client.ts';
import {GenericDataResponse, Order} from "../types.ts";

export const ticketLookupClient = {
    sendTicketLookupEmail: async (email: string) => {
        const response = await api.post<{ message: string, token?: string }>('public/ticket-lookup', { email });
        return response.data;
    },

    // The emailed link, swapped for an HttpOnly cookie: the link itself is never kept.
    openSession: async (token: string) => {
        await api.post(`public/ticket-lookup/${encodeURIComponent(token)}/session`);
    },

    closeSession: async () => {
        await api.delete('public/ticket-lookup/session');
    },

    getOrders: async () => {
        const response = await api.get<GenericDataResponse<Order[]>>('public/ticket-lookup');
        return response.data;
    },
}
