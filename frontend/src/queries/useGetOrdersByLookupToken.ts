import {useQuery} from "@tanstack/react-query";
import {ticketLookupClient} from "../api/ticket-lookup.client.ts";
import {Order} from "../types.ts";
import {AxiosError} from "axios";

export const GET_ORDERS_BY_LOOKUP_TOKEN_QUERY_KEY = "getOrdersByLookupToken";

// Le lien n'est refuse que si le serveur l'a refuse (4xx); sans reseau ou sur une panne, on
// garde le lien et on propose de reessayer.
export class TicketLookupError extends Error {
    constructor(message: string | undefined, public readonly status?: number) {
        super(message ?? '');
    }

    get linkRejected() {
        return !!this.status && this.status >= 400 && this.status < 500;
    }
}

export const useGetOrdersByLookupToken = (token: string | undefined) => {
    return useQuery<Order[], TicketLookupError>({
        queryKey: [GET_ORDERS_BY_LOOKUP_TOKEN_QUERY_KEY, token],
        queryFn: async () => {
            if (!token) {
                throw new TicketLookupError(undefined, 400);
            }
            try {
                const {data} = await ticketLookupClient.getOrdersByToken(token);
                return data;
            } catch (e) {
                const axiosError = e as AxiosError<{ message?: string }>;
                const message = axiosError.response?.data?.message;
                throw new TicketLookupError(message, axiosError.response?.status);
            }
        },
        enabled: !!token,
        refetchOnWindowFocus: false,
        retry: false,
    });
};
