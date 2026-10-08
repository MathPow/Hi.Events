import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {messagesClient, SendMessageRequest} from "../api/messages.client.ts";
import {GET_EVENT_MESSAGES_QUERY_KEY} from "../queries/useGetEventMessages.ts";

export const useSendEventMessage = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({messageData, eventId}: {
            messageData: SendMessageRequest,
            eventId: IdParam,
        }) => messagesClient.send(eventId, messageData),

        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: [GET_EVENT_MESSAGES_QUERY_KEY, variables.eventId]
            });
        }
    });
}
