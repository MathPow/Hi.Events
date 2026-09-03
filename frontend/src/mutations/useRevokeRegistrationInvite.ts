import {useMutation, useQueryClient} from "@tanstack/react-query";
import {adminClient} from "../api/admin.client";
import {IdParam} from "../types";
import {GET_REGISTRATION_INVITES_QUERY_KEY} from "../queries/useGetRegistrationInvites";

export const useRevokeRegistrationInvite = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (inviteId: IdParam) => adminClient.revokeRegistrationInvite(inviteId),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: GET_REGISTRATION_INVITES_QUERY_KEY});
        },
    });
};
