import {useMutation, useQueryClient} from "@tanstack/react-query";
import {organizerClient} from "../api/organizer.client.ts";
import {IdParam} from "../types.ts";
import {GET_ORGANIZER_STRIPE_CONNECTION_QUERY_KEY} from "../queries/useGetOrganizerStripeConnection.ts";

export const useConnectOrganizerStripe = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (organizerId: IdParam) => organizerClient.connectStripe(organizerId),
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: [GET_ORGANIZER_STRIPE_CONNECTION_QUERY_KEY]});
        },
    });
};
