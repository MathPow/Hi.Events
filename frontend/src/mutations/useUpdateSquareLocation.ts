import {useMutation, useQueryClient} from "@tanstack/react-query";
import {squareClient} from "../api/square.client.ts";
import {IdParam} from "../types.ts";
import {GET_SQUARE_CONNECTION_QUERY_KEY} from "../queries/useGetSquareConnection.ts";

export const useUpdateSquareLocation = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({accountId, locationId}: { accountId: IdParam, locationId: string }) =>
            squareClient.updateLocation(accountId, locationId),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: [GET_SQUARE_CONNECTION_QUERY_KEY]});
        },
    });
};
