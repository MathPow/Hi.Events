import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {eventsClient} from "../api/event.client.ts";

export const GET_EVENT_CHECK_IN_STATS_QUERY_KEY = 'getEventCheckInStats';

// How many of the event's attendees have arrived, refreshed while the doors are open.
export const useGetEventCheckInStats = (eventId: IdParam) => {
    return useQuery({
        queryKey: [GET_EVENT_CHECK_IN_STATS_QUERY_KEY, eventId],
        queryFn: async () => (await eventsClient.getEventCheckInStats(eventId)).data,
        refetchInterval: 30_000,
    });
};
