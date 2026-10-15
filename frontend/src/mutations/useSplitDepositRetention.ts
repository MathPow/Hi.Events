import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {orderClient, SplitDepositRetentionRequest} from "../api/order.client.ts";
import {GET_EVENT_DEPOSITS_QUERY_KEY} from "../queries/useGetEventDeposits.ts";

export const useSplitDepositRetention = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({eventId, payload}: {
            eventId: IdParam,
            payload: SplitDepositRetentionRequest,
        }) => orderClient.splitDepositRetention(eventId, payload),

        onSuccess: (_, variables) => queryClient.invalidateQueries({
            queryKey: [GET_EVENT_DEPOSITS_QUERY_KEY, variables.eventId],
        }),
    });
};
