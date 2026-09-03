import {useQuery} from "@tanstack/react-query";
import {adminClient} from "../api/admin.client";

export const GET_REGISTRATION_INVITES_QUERY_KEY = ['admin', 'registration-invites'];

export const useGetRegistrationInvites = () => {
    return useQuery({
        queryKey: GET_REGISTRATION_INVITES_QUERY_KEY,
        queryFn: () => adminClient.getRegistrationInvites(),
    });
};
