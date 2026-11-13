import {useQuery} from "@tanstack/react-query";
import {AxiosError} from "axios";
import {IdParam} from "../types.ts";
import {ticketTransferClientPublic, TicketTransferEligibility} from "../api/ticketTransfer.client.ts";

export const GET_TICKET_TRANSFER_QUERY_KEY = 'getTicketTransfer';

export const useGetTicketTransfer = (eventId: IdParam, attendeeShortId?: string, enabled = true) => {
    return useQuery<TicketTransferEligibility, AxiosError>({
        queryKey: [GET_TICKET_TRANSFER_QUERY_KEY, eventId, attendeeShortId],
        queryFn: () => ticketTransferClientPublic.getEligibility(eventId, attendeeShortId!),
        enabled: enabled && !!eventId && !!attendeeShortId,
        refetchOnWindowFocus: false,
        retry: false,
    });
};
