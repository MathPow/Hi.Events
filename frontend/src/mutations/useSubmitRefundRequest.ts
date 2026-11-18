import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {refundRequestClientPublic} from "../api/eventChange.client.ts";
import {GET_REFUND_REQUEST_QUERY_KEY} from "../queries/useGetRefundRequest.ts";

export const useSubmitRefundRequest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({eventId, orderShortId, change, token}: {
            eventId: IdParam,
            orderShortId: string,
            change: string,
            token: string,
        }) => refundRequestClientPublic.submit(eventId, orderShortId, change, token),

        onSuccess: (refundRequest, {eventId, orderShortId, change, token}) => {
            queryClient.setQueryData([GET_REFUND_REQUEST_QUERY_KEY, eventId, orderShortId, change, token], refundRequest);
        },
    });
};
