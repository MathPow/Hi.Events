import {getQueryClient} from "../utilites/ssrQueryClient.ts";
import {getUpcomingEventsPublicQuery} from "../queries/useGetUpcomingEventsPublic.ts";

// Les prochains evenements du bandeau de l'accueil, rendus par le serveur pour que la page ne
// saute pas a leur arrivee. prefetchQuery n'echoue jamais: API en panne, l'accueil s'affiche
// sans bandeau.
export const landingRouteLoader = async () => {
    await getQueryClient().prefetchQuery(getUpcomingEventsPublicQuery());

    return null;
};
