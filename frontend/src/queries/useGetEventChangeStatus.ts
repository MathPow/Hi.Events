import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {eventChangeClient} from "../api/eventChange.client.ts";

export const GET_EVENT_CHANGE_STATUS_QUERY_KEY = 'getEventChangeStatus';

// Refunds of a cancelled event run in the background: the card checks again while some wait.
export const useGetEventChangeStatus = (eventId: IdParam) => {
    return useQuery({
        queryKey: [GET_EVENT_CHANGE_STATUS_QUERY_KEY, eventId],
        staleTime: 0,
        queryFn: () => eventChangeClient.getStatus(eventId),
        refetchInterval: (query) => (query.state.data?.cancellation?.counts?.PENDING ?? 0) > 0 ? 5000 : false,
    });
};
