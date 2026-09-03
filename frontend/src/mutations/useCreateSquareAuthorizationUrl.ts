import {useMutation} from "@tanstack/react-query";
import {squareClient} from "../api/square.client.ts";
import {IdParam} from "../types.ts";

export const useCreateSquareAuthorizationUrl = () => {
    return useMutation({
        mutationFn: (accountId: IdParam) => squareClient.createAuthorizationUrl(accountId),
    });
};
