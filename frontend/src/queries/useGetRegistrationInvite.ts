import {useQuery} from "@tanstack/react-query";
import {authClient} from "../api/auth.client.ts";

export const GET_REGISTRATION_INVITE_QUERY_KEY = 'getRegistrationInvite';

export const useGetRegistrationInvite = (token: string | null) => {
    return useQuery({
        queryKey: [GET_REGISTRATION_INVITE_QUERY_KEY, token],

        queryFn: async () => {
            return await authClient.getRegistrationInvite(String(token));
        },

        enabled: !!token,
        retry: false,
    });
};
