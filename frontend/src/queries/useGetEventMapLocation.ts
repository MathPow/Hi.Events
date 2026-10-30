import {useQuery} from "@tanstack/react-query";
import {eventsClientPublic} from "../api/event.client.ts";
import {IdParam} from "../types.ts";

export const GET_EVENT_MAP_LOCATION_QUERY_KEY = 'getEventMapLocation';

// Un lieu introuvable rend un 404: pas de nouvel essai, la carte reste dessinee.
export const useGetEventMapLocation = (eventId: IdParam, enabled: boolean) => {
    return useQuery({
        queryKey: [GET_EVENT_MAP_LOCATION_QUERY_KEY, eventId],
        queryFn: async () => {
            const {data} = await eventsClientPublic.mapLocation(eventId);
            return data;
        },
        enabled,
        retry: false,
        staleTime: Infinity,
    });
};
