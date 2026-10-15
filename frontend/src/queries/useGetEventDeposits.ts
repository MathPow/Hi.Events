import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {orderClient} from "../api/order.client.ts";

export const GET_EVENT_DEPOSITS_QUERY_KEY = 'getEventDeposits';

export const useGetEventDeposits = (eventId: IdParam) => {
    return useQuery({
        queryKey: [GET_EVENT_DEPOSITS_QUERY_KEY, eventId],

        queryFn: async () => {
            const {data} = await orderClient.deposits(eventId);
            return data;
        }
    });
};
