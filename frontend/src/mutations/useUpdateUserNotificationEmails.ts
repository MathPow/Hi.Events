import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {userClient} from "../api/user.client.ts";
import {GET_USERS_QUERY_KEY} from "../queries/useGetUsers.ts";

export interface NotificationEmailSettings {
    organizer_messages?: boolean;
    new_orders?: boolean;
}

export const useUpdateUserNotificationEmails = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({userId, settings}: { userId: IdParam, settings: NotificationEmailSettings }) =>
            userClient.updateNotificationEmails(userId, settings),
        onSuccess: () => queryClient.invalidateQueries({queryKey: [GET_USERS_QUERY_KEY]}),
    });
}
