import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {eventRouteFileClientPublic} from "../api/eventRouteFile.client.ts";

export const GET_EVENT_ROUTE_FILES_PUBLIC_QUERY_KEY = 'getEventRouteFilesPublic';

export const useGetEventRouteFilesPublic = (eventId: IdParam) => {
    return useQuery({
        queryKey: [GET_EVENT_ROUTE_FILES_PUBLIC_QUERY_KEY, eventId],
        queryFn: async () => (await eventRouteFileClientPublic.all(eventId)).data,
        enabled: !!eventId,
        refetchOnWindowFocus: false,
        retry: false,
    });
};
