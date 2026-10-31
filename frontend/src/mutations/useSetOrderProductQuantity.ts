import {useMutation, useQueryClient} from "@tanstack/react-query";
import {orderClientPublic} from "../api/order.client.ts";
import {IdParam} from "../types.ts";
import {GET_ORDER_PUBLIC_QUERY_KEY} from "../queries/useGetOrderPublic.ts";
import {GET_EVENT_PUBLIC_QUERY_KEY} from "../queries/useGetEventPublic.ts";

// Ajoute ou retire de la merch d'une commande reservee; la commande (et le panneau « Votre
// commande ») se recharge, l'evenement aussi pour les quantites restantes.
export const useSetOrderProductQuantity = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({eventId, orderShortId, productId, productPriceId, quantity}: {
            eventId: IdParam,
            orderShortId: IdParam,
            productId: IdParam,
            productPriceId: IdParam,
            quantity: number,
        }) => orderClientPublic.setProductQuantity(eventId, orderShortId, {
            product_id: productId,
            product_price_id: productPriceId,
            quantity,
        }, typeof window === 'undefined' ? null : new URL(window.location.href).searchParams.get('session_identifier')),

        onSuccess: () => {
            return Promise.all([
                queryClient.invalidateQueries({queryKey: [GET_ORDER_PUBLIC_QUERY_KEY]}),
                queryClient.invalidateQueries({queryKey: [GET_EVENT_PUBLIC_QUERY_KEY]}),
            ]);
        },
    });
};
