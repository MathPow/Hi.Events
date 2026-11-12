import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {userClient} from "../api/user.client.ts";
import {GET_USERS_QUERY_KEY} from "../queries/useGetUsers.ts";

export const useUpdateUserMessageEmails = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({userId, enabled}: { userId: IdParam, enabled: boolean }) =>
            userClient.updateOrganizerMessageEmails(userId, enabled),
        onSuccess: () => queryClient.invalidateQueries({queryKey: [GET_USERS_QUERY_KEY]}),
    });
}
