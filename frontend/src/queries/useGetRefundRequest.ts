import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {refundRequestClientPublic} from "../api/eventChange.client.ts";

export const GET_REFUND_REQUEST_QUERY_KEY = 'getRefundRequest';

export const useGetRefundRequest = (eventId: IdParam, orderShortId: string, change: string | null, token: string | null) => {
    return useQuery({
        queryKey: [GET_REFUND_REQUEST_QUERY_KEY, eventId, orderShortId, change, token],
        enabled: !!eventId && !!orderShortId && !!change && !!token,
        retry: false,
        queryFn: () => refundRequestClientPublic.get(eventId, orderShortId, change!, token!),
    });
};
