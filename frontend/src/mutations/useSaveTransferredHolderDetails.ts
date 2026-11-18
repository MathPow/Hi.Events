import {useMutation} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {HolderDetailsInput, ticketTransferClientPublic} from "../api/ticketTransfer.client.ts";

export const useSaveTransferredHolderDetails = () => {
    return useMutation({
        mutationFn: ({eventId, attendeeShortId, input}: {
            eventId: IdParam;
            attendeeShortId: string;
            input: HolderDetailsInput;
        }) => ticketTransferClientPublic.saveDetails(eventId, attendeeShortId, input),
    });
};
