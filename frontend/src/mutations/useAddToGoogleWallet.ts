import {useMutation} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {orderClientPublic} from "../api/order.client.ts";

// Google writes the tickets, then its page (or the Wallet app) adds them.
export const useAddToGoogleWallet = () => {
    return useMutation({
        mutationFn: ({eventId, orderShortId}: {
            eventId: IdParam;
            orderShortId: string;
        }) => orderClientPublic.getGoogleWalletSaveUrl(eventId, orderShortId),
        onSuccess: (saveUrl) => {
            window.location.href = saveUrl;
        },
    });
}
