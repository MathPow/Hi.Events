import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {eventsClient} from "../api/event.client.ts";
import {GET_EVENT_QUERY_KEY} from "../queries/useGetEvent.ts";
import {GET_EVENTS_QUERY_KEY} from "../queries/useGetEvents.ts";
import {GET_ORGANIZER_EVENTS_QUERY} from "../queries/useGetOrganizerEvents.ts";

export const useRepeatEvent = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({eventId, dates}: { eventId: IdParam, dates: string[] }) => eventsClient.repeat(eventId, dates),

        onSuccess: (_, variables) => Promise.all([
            queryClient.invalidateQueries({queryKey: [GET_EVENT_QUERY_KEY, variables.eventId]}),
            queryClient.invalidateQueries({queryKey: [GET_EVENTS_QUERY_KEY]}),
            queryClient.invalidateQueries({queryKey: [GET_ORGANIZER_EVENTS_QUERY]}),
        ]),
    });
};
