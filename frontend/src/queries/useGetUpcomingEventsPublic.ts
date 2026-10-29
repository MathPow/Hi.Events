import {useQuery} from "@tanstack/react-query";
import {eventsClientPublic} from "../api/event.client.ts";

export const GET_UPCOMING_EVENTS_PUBLIC_QUERY_KEY = 'getUpcomingEventsPublic';

// Le repertoire d'evenements les veut tous: le maximum de l'API.
export const ALL_UPCOMING_EVENTS = 100;

export const getUpcomingEventsPublicQuery = (perPage?: number) => ({
    queryKey: perPage ? [GET_UPCOMING_EVENTS_PUBLIC_QUERY_KEY, perPage] : [GET_UPCOMING_EVENTS_PUBLIC_QUERY_KEY],

    queryFn: async () => {
        const {data} = await eventsClientPublic.upcoming(perPage);
        return data;
    },
});

export const useGetUpcomingEventsPublic = (perPage?: number) => {
    return useQuery(getUpcomingEventsPublicQuery(perPage));
};
