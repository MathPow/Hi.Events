import {useQuery} from "@tanstack/react-query";
import {organizerClient} from "../api/organizer.client.ts";
import {IdParam} from "../types.ts";

export const GET_ORGANIZER_STRIPE_CONNECTION_QUERY_KEY = 'getOrganizerStripeConnection';

export const useGetOrganizerStripeConnection = (organizerId: IdParam, refresh: boolean = false) => {
    return useQuery({
        queryKey: [GET_ORGANIZER_STRIPE_CONNECTION_QUERY_KEY, organizerId, refresh],
        queryFn: () => organizerClient.getStripeConnection(organizerId, refresh),
        enabled: !!organizerId,
    });
};
