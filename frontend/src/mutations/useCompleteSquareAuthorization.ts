import {useMutation, useQueryClient} from "@tanstack/react-query";
import {squareClient} from "../api/square.client.ts";
import {IdParam} from "../types.ts";
import {GET_SQUARE_CONNECTION_QUERY_KEY} from "../queries/useGetSquareConnection.ts";

export const useCompleteSquareAuthorization = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({accountId, code, state}: { accountId: IdParam, code: string, state: string }) =>
            squareClient.completeAuthorization(accountId, {code, state}),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: [GET_SQUARE_CONNECTION_QUERY_KEY]});
        },
    });
};
