import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {EventRouteFile, eventRouteFileClientPublic} from "../api/eventRouteFile.client.ts";
import {parseGpx} from "../utilites/course/gpx.ts";

export const GET_EVENT_ROUTE_FILE_GPX_QUERY_KEY = 'getEventRouteFileGpx';

/** A saved route's GPX, read: its line for the thumbnail and the figures, and for editing it on the map. */
export const eventRouteFileGpxQuery = (eventId: IdParam, routeFile: EventRouteFile) => ({
    queryKey: [GET_EVENT_ROUTE_FILE_GPX_QUERY_KEY, eventId, routeFile.id, routeFile.size],
    queryFn: async () => {
        const response = await fetch(eventRouteFileClientPublic.downloadUrl(eventId, routeFile.id));
        if (!response.ok) {
            throw new Error(String(response.status));
        }
        return parseGpx(await response.text());
    },
    staleTime: Infinity,
    retry: 1,
});

export const useGetEventRouteFileGpx = (eventId: IdParam, routeFile: EventRouteFile) =>
    useQuery(eventRouteFileGpxQuery(eventId, routeFile));
