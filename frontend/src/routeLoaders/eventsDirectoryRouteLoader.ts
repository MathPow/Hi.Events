import {getQueryClient} from "../utilites/ssrQueryClient.ts";
import {ALL_UPCOMING_EVENTS, getUpcomingEventsPublicQuery} from "../queries/useGetUpcomingEventsPublic.ts";

// Les evenements du repertoire, rendus par le serveur. prefetchQuery n'echoue jamais: API en
// panne, le repertoire s'affiche vide.
export const eventsDirectoryRouteLoader = async () => {
    await getQueryClient().prefetchQuery(getUpcomingEventsPublicQuery(ALL_UPCOMING_EVENTS));

    return null;
};
