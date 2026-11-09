import {useQuery} from "@tanstack/react-query";
import {orderClientPublic} from "../api/order.client.ts";
import {IdParam, Order} from "../types.ts";
import {useMemo} from "react";
import {isSsr} from "../utilites/helpers.ts";

export const GET_ORDER_PUBLIC_QUERY_KEY = "getOrderPublic";

const SETTLED_STATUSES = ['COMPLETED', 'CANCELLED', 'AWAITING_OFFLINE_PAYMENT', 'ABANDONED'];

// Une commande abandonnee ne bougera plus: on arrete d'attendre. (Une reservation expiree reste
// en attente: un paiement Stripe deja fait peut encore la confirmer.)
export const isOrderLapsed = (order?: Order) => order?.status === 'ABANDONED';

export const isOrderSettled = (order?: Order) => !!order
    && (SETTLED_STATUSES.includes(order.status) || order.payment_status === 'PAYMENT_FAILED' || isOrderLapsed(order));

const getSessionIdentifierFromUrl = (): string | null => {
    if (isSsr()) return null;

    const url = new URL(window.location.href);
    return url.searchParams.get("session_identifier");
};

export const useGetOrderPublic = (
    eventId: IdParam,
    orderShortId: IdParam,
    includes: string[] = [],
    pollUntilSettled = false,
) => {
    const sessionIdentifier = useMemo(getSessionIdentifierFromUrl, []);

    return useQuery<Order>({
        queryKey: [
            GET_ORDER_PUBLIC_QUERY_KEY,
            eventId,
            orderShortId,
            sessionIdentifier,
        ],
        queryFn: async () => {
            const {data} = await orderClientPublic.findByShortId(
                Number(eventId),
                String(orderShortId),
                includes,
                sessionIdentifier ?? undefined
            );
            return data;
        },
        refetchOnWindowFocus: false,
        // Tant que le paiement n'est pas confirme, la page se met a jour d'elle-meme.
        refetchInterval: pollUntilSettled
            ? (query) => isOrderSettled(query.state.data) ? false : 5000
            : false,
        staleTime: 500,
        retryOnMount: false,
        retry: false,
    });
};
