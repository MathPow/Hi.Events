import {useQuery} from "@tanstack/react-query";
import {ticketLookupClient} from "../api/ticket-lookup.client.ts";
import {Order} from "../types.ts";
import {AxiosError} from "axios";

export const GET_TICKET_LOOKUP_ORDERS_QUERY_KEY = "getTicketLookupOrders";

// Refused only when the server says so (4xx: no cookie, expired); offline or on an outage, the
// page offers to try again.
export class TicketLookupError extends Error {
    constructor(message: string | undefined, public readonly status?: number) {
        super(message ?? '');
    }

    get linkRejected() {
        return !!this.status && this.status >= 400 && this.status < 500 && ![408, 429].includes(this.status);
    }
}

export const useGetTicketLookupOrders = (enabled: boolean) => {
    return useQuery<Order[], TicketLookupError>({
        queryKey: [GET_TICKET_LOOKUP_ORDERS_QUERY_KEY],
        queryFn: async () => {
            try {
                const {data} = await ticketLookupClient.getOrders();
                return data;
            } catch (e) {
                const axiosError = e as AxiosError<{ message?: string }>;
                throw new TicketLookupError(axiosError.response?.data?.message, axiosError.response?.status);
            }
        },
        enabled,
        refetchOnWindowFocus: false,
        retry: false,
    });
};
