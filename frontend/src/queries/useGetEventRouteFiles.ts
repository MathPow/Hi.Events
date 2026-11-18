import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {eventRouteFileClient} from "../api/eventRouteFile.client.ts";

export const GET_EVENT_ROUTE_FILES_QUERY_KEY = 'getEventRouteFiles';

export const useGetEventRouteFiles = (eventId: IdParam) => {
    return useQuery({
        queryKey: [GET_EVENT_ROUTE_FILES_QUERY_KEY, eventId],
        queryFn: async () => (await eventRouteFileClient.all(eventId)).data,
    });
};
