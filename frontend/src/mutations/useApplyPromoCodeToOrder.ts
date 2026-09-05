import {useMutation, useQueryClient} from "@tanstack/react-query";
import {orderClientPublic} from "../api/order.client.ts";
import {IdParam} from "../types.ts";
import {GET_ORDER_PUBLIC_QUERY_KEY} from "../queries/useGetOrderPublic.ts";
import {GET_EVENT_PUBLIC_QUERY_KEY} from "../queries/useGetEventPublic.ts";

export const useApplyPromoCodeToOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({eventId, orderShortId, promoCode}: {
            eventId: IdParam,
            orderShortId: IdParam,
            promoCode: string | null,
        }) => orderClientPublic.applyPromoCode(eventId, orderShortId, promoCode),

        onSuccess: () => {
            return Promise.all([
                queryClient.invalidateQueries({queryKey: [GET_ORDER_PUBLIC_QUERY_KEY]}),
                queryClient.invalidateQueries({queryKey: [GET_EVENT_PUBLIC_QUERY_KEY]}),
            ]);
        },
    });
};
