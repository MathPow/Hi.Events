import {useMutation, useQueryClient} from "@tanstack/react-query";
import {adminClient, CreateRegistrationInviteData} from "../api/admin.client";
import {GET_REGISTRATION_INVITES_QUERY_KEY} from "../queries/useGetRegistrationInvites";

export const useCreateRegistrationInvite = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateRegistrationInviteData) => adminClient.createRegistrationInvite(data),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: GET_REGISTRATION_INVITES_QUERY_KEY});
        },
    });
};
