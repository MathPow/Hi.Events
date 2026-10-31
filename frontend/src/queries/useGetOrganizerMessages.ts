import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {organizerMessageClient} from "../api/organizerMessage.client.ts";

export const GET_ORGANIZER_MESSAGES_QUERY_KEY = 'getOrganizerMessages';
export const GET_ORGANIZER_UNREAD_MESSAGES_QUERY_KEY = 'getOrganizerUnreadMessages';

export const useGetOrganizerMessages = (organizerId: IdParam, page: number, unreadOnly: boolean) => {
    return useQuery({
        queryKey: [GET_ORGANIZER_MESSAGES_QUERY_KEY, organizerId, page, unreadOnly],
        enabled: !!organizerId,
        placeholderData: keepPreviousData,
        // Un message peut arriver pendant que la page est ouverte.
        refetchInterval: 60_000,
        queryFn: () => organizerMessageClient.list(organizerId, page, unreadOnly),
    });
};

// La pastille du menu: relue chaque minute et au retour sur l'onglet.
export const useGetOrganizerUnreadMessagesCount = (organizerId: IdParam) => {
    return useQuery({
        queryKey: [GET_ORGANIZER_UNREAD_MESSAGES_QUERY_KEY, organizerId],
        enabled: !!organizerId,
        refetchInterval: 60_000,
        refetchOnWindowFocus: true,
        queryFn: () => organizerMessageClient.unreadCount(organizerId),
    });
};
