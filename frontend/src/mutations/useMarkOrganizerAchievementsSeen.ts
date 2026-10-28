import {organizerClient} from "../api/organizer.client.ts";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {GET_ORGANIZER_ACHIEVEMENTS_QUERY_KEY} from "../queries/useGetOrganizerAchievements.ts";

export const useMarkOrganizerAchievementsSeen = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({organizerId}: { organizerId: IdParam }) => organizerClient.markAchievementsSeen(organizerId),

        onSuccess: (_, variables) => queryClient.invalidateQueries({
            queryKey: [GET_ORGANIZER_ACHIEVEMENTS_QUERY_KEY, variables.organizerId]
        }),
    });
}
