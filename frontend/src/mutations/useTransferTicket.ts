import {useMutation} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {ticketTransferClientPublic, TicketTransferRecipient} from "../api/ticketTransfer.client.ts";

export const useTransferTicket = () => {
    return useMutation({
        mutationFn: ({eventId, attendeeShortId, recipient}: {
            eventId: IdParam;
            attendeeShortId: string;
            recipient: TicketTransferRecipient;
        }) => ticketTransferClientPublic.transfer(eventId, attendeeShortId, recipient),
    });
};
