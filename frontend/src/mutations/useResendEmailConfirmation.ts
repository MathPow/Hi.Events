import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {userClient} from "../api/user.client.ts";
import {GET_ME_QUERY_KEY} from "../queries/useGetMe.ts";

export const useResendEmailConfirmation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({userId}: {
            userId: IdParam,
        }) => userClient.resendConfirmation(userId),

        // Sur dev (APP_SKIP_EMAIL_VERIFICATION), le renvoi confirme le courriel sur-le-champ.
        onSuccess: () => queryClient.invalidateQueries({queryKey: [GET_ME_QUERY_KEY]}),
    });
}