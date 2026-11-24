import {useMutation} from "@tanstack/react-query";
import {IdParam} from '../types';
import {EditOrderPayload, orderClient} from '../api/order.client';
import {invalidateOrderViews} from "../utilites/invalidateOrderViews.ts";

export const useEditOrder = () => {
    return useMutation({
        mutationFn: ({eventId, orderId, payload}: {
            eventId: IdParam,
            orderId: IdParam,
            payload: EditOrderPayload
        }) => orderClient.editOrder(eventId, orderId, payload),
        onSuccess: () => invalidateOrderViews(),
    });
}
