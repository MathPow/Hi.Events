import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {orderClient, UpdateOrderDepositRequest} from "../api/order.client.ts";
import {GET_EVENT_DEPOSITS_QUERY_KEY} from "../queries/useGetEventDeposits.ts";

export const useUpdateOrderDeposit = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({eventId, orderId, payload}: {
            eventId: IdParam,
            orderId: IdParam,
            payload: UpdateOrderDepositRequest,
        }) => orderClient.updateDeposit(eventId, orderId, payload),

        onSuccess: (_, variables) => queryClient.invalidateQueries({
            queryKey: [GET_EVENT_DEPOSITS_QUERY_KEY, variables.eventId],
        }),
    });
};
