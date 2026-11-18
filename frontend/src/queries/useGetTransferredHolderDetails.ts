import {useQuery} from "@tanstack/react-query";
import {AxiosError} from "axios";
import {IdParam, Question} from "../types.ts";
import {ticketTransferClientPublic} from "../api/ticketTransfer.client.ts";

export const GET_TRANSFERRED_HOLDER_DETAILS_QUERY_KEY = 'getTransferredHolderDetails';

export const useGetTransferredHolderDetails = (eventId: IdParam, attendeeShortId: string) => {
    return useQuery<Question[], AxiosError>({
        queryKey: [GET_TRANSFERRED_HOLDER_DETAILS_QUERY_KEY, eventId, attendeeShortId],
        queryFn: () => ticketTransferClientPublic.getPendingDetails(eventId, attendeeShortId),
        refetchOnWindowFocus: false,
        retry: false,
    });
};
