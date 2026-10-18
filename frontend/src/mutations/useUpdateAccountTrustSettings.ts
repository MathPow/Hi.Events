import {useMutation, useQueryClient} from "@tanstack/react-query";
import {adminClient, UpdateAccountTrustSettingsRequest} from "../api/admin.client";
import {IdParam} from "../types";
import {GET_ADMIN_ACCOUNT_QUERY_KEY} from "../queries/useGetAdminAccount";
import {GET_ALL_ACCOUNTS_QUERY_KEY} from "../queries/useGetAllAccounts";

export const useUpdateAccountTrustSettings = (accountId: IdParam) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (settings: UpdateAccountTrustSettingsRequest) => adminClient.updateAccountTrustSettings(accountId, settings),
        onSuccess: () => {
            return Promise.all([
                queryClient.invalidateQueries({queryKey: [...GET_ADMIN_ACCOUNT_QUERY_KEY, accountId]}),
                queryClient.invalidateQueries({queryKey: GET_ALL_ACCOUNTS_QUERY_KEY})
            ]);
        },
    });
};
