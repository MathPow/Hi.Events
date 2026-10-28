import {useQuery} from "@tanstack/react-query";
import {eventsClientPublic} from "../api/event.client.ts";

export const GET_UPCOMING_EVENTS_PUBLIC_QUERY_KEY = 'getUpcomingEventsPublic';

export const getUpcomingEventsPublicQuery = () => ({
    queryKey: [GET_UPCOMING_EVENTS_PUBLIC_QUERY_KEY],

    queryFn: async () => {
        const {data} = await eventsClientPublic.upcoming();
        return data;
    },
});

export const useGetUpcomingEventsPublic = () => {
    return useQuery(getUpcomingEventsPublicQuery());
};
