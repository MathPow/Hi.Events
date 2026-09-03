import {useQuery} from "@tanstack/react-query";
import {squareClient} from "../api/square.client.ts";
import {IdParam} from "../types.ts";

export const GET_SQUARE_CONNECTION_QUERY_KEY = 'getSquareConnection';

export const useGetSquareConnection = (accountId: IdParam, enabled: boolean = true) => {
    return useQuery({
        queryKey: [GET_SQUARE_CONNECTION_QUERY_KEY, accountId],
        queryFn: () => squareClient.getConnection(accountId),
        enabled: enabled && !!accountId,
    });
};
