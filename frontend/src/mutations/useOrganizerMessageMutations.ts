import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {organizerMessageClient} from "../api/organizerMessage.client.ts";
import {
    GET_ORGANIZER_MESSAGES_QUERY_KEY,
    GET_ORGANIZER_UNREAD_MESSAGES_QUERY_KEY,
} from "../queries/useGetOrganizerMessages.ts";

const useRefreshInbox = () => {
    const queryClient = useQueryClient();

    return (organizerId: IdParam) => Promise.all([
        queryClient.invalidateQueries({queryKey: [GET_ORGANIZER_MESSAGES_QUERY_KEY, organizerId]}),
        queryClient.invalidateQueries({queryKey: [GET_ORGANIZER_UNREAD_MESSAGES_QUERY_KEY, organizerId]}),
    ]);
};

export const useSetOrganizerMessageRead = () => {
    const refresh = useRefreshInbox();

    return useMutation({
        mutationFn: ({organizerId, messageId, read}: { organizerId: IdParam, messageId: IdParam, read: boolean }) =>
            organizerMessageClient.setRead(organizerId, messageId, read),
        onSuccess: (_, {organizerId}) => refresh(organizerId),
    });
};

export const useMarkAllOrganizerMessagesRead = () => {
    const refresh = useRefreshInbox();

    return useMutation({
        mutationFn: ({organizerId}: { organizerId: IdParam }) => organizerMessageClient.markAllRead(organizerId),
        onSuccess: (_, {organizerId}) => refresh(organizerId),
    });
};

export const useDeleteOrganizerMessage = () => {
    const refresh = useRefreshInbox();

    return useMutation({
        mutationFn: ({organizerId, messageId}: { organizerId: IdParam, messageId: IdParam }) =>
            organizerMessageClient.remove(organizerId, messageId),
        onSuccess: (_, {organizerId}) => refresh(organizerId),
    });
};
