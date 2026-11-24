import {useMutation} from "@tanstack/react-query";
import {orderClient} from "../api/order.client.ts";
import {IdParam} from "../types.ts";
import {invalidateOrderViews} from "../utilites/invalidateOrderViews.ts";

export const useMarkOrderAsPaid = () => {
    return useMutation({
        mutationFn: ({eventId, orderId}: {
            eventId: IdParam,
            orderId: IdParam,
        }) => {
            return orderClient.markAsPaid(eventId, orderId);
        },
        onSuccess: () => invalidateOrderViews(),
    });
}
