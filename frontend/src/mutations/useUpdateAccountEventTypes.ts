import {useMutation, useQueryClient} from "@tanstack/react-query";
import {AccountEventType, IdParam} from "../types.ts";
import {accountClient} from "../api/account.client.ts";
import {GET_ACCOUNT_QUERY_KEY} from "../queries/useGetAccount.ts";

export const useUpdateAccountEventTypes = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({accountId, eventTypes}: {
            accountId: IdParam,
            eventTypes: AccountEventType[],
        }) => accountClient.updateEventTypes(accountId, eventTypes),

        onSuccess: () => queryClient.invalidateQueries({queryKey: [GET_ACCOUNT_QUERY_KEY]}),
    });
}
