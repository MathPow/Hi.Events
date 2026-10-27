import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {bibNumberClient} from "../api/bib-number.client.ts";
import {GET_ATTENDEES_QUERY_KEY} from "../queries/useGetAttendees.ts";

export const useAssignBibNumbers = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({eventId}: { eventId: IdParam }) => bibNumberClient.assign(eventId),

        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: [GET_ATTENDEES_QUERY_KEY]});
        }
    });
}
