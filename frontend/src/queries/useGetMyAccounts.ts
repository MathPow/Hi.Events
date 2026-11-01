import {useQuery} from "@tanstack/react-query";
import {authClient} from "../api/auth.client.ts";

export const GET_MY_ACCOUNTS_QUERY_KEY = 'getMyAccounts';

export const useGetMyAccounts = () => {
    return useQuery({
        queryKey: [GET_MY_ACCOUNTS_QUERY_KEY],
        queryFn: () => authClient.myAccounts(),
    });
};
