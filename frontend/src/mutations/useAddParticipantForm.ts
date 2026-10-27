import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {questionClient} from "../api/question.client.ts";
import {GET_EVENT_QUESTIONS_QUERY_KEY} from "../queries/useGetEventQuestions.ts";

export const useAddParticipantForm = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({eventId}: { eventId: IdParam }) => questionClient.addParticipantForm(eventId),

        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: [GET_EVENT_QUESTIONS_QUERY_KEY, variables.eventId]
            });
        }
    });
}
