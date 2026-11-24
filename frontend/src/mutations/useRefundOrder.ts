import {useMutation} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {orderClient, RefundOrderPayload} from "../api/order.client.ts";
import {invalidateOrderViews} from "../utilites/invalidateOrderViews.ts";

export const useRefundOrder = () => {
    return useMutation({
        mutationFn: ({eventId, orderId, refundData}: {
            eventId: IdParam,
            orderId: IdParam,
            refundData: RefundOrderPayload
        }) => orderClient.refund(eventId, orderId, refundData),

        onSuccess: () => invalidateOrderViews(),
    });
}
