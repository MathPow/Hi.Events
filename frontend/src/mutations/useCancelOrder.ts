import {useMutation} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {orderClient} from "../api/order.client.ts";
import {invalidateOrderViews} from "../utilites/invalidateOrderViews.ts";

export const useCancelOrder = () => {
    return useMutation({
        mutationFn: ({eventId, orderId, refund}: {
            eventId: IdParam,
            orderId: IdParam,
            refund?: boolean,
        }) => orderClient.cancel(eventId, orderId, refund),

        onSuccess: () => invalidateOrderViews(),
    });
}
