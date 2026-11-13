import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {CancelEventRequest, eventChangeClient} from "../api/eventChange.client.ts";
import {GET_EVENT_CHANGE_STATUS_QUERY_KEY} from "../queries/useGetEventChangeStatus.ts";
import {GET_EVENT_QUERY_KEY} from "../queries/useGetEvent.ts";
import {GET_EVENT_PUBLIC_QUERY_KEY} from "../queries/useGetEventPublic.ts";
import {GET_EVENTS_QUERY_KEY} from "../queries/useGetEvents.ts";

export const useCancelEvent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({eventId, request}: { eventId: IdParam, request: CancelEventRequest }) =>
            eventChangeClient.cancel(eventId, request),

        onSuccess: (status, {eventId}) => {
            queryClient.setQueryData([GET_EVENT_CHANGE_STATUS_QUERY_KEY, eventId], status);
            return Promise.all([
                queryClient.invalidateQueries({queryKey: [GET_EVENT_QUERY_KEY, eventId]}),
                queryClient.invalidateQueries({queryKey: [GET_EVENT_PUBLIC_QUERY_KEY, eventId]}),
                queryClient.invalidateQueries({queryKey: [GET_EVENTS_QUERY_KEY]}),
            ]);
        },
    });
};
