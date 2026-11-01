import {keepPreviousData, useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {organizerClient} from "../api/organizer.client.ts";

export const GET_ORGANIZER_STATS_QUERY_KEY = 'getOrganizerStats';

export const useGetOrganizerStats = (
    organizerId: IdParam,
    currencyCode?: string,
    // Totals of the last N days compared with the N days before; all time without it.
    periodDays?: number | null,
) => {
    return useQuery({
        queryKey: [GET_ORGANIZER_STATS_QUERY_KEY, organizerId, currencyCode, periodDays ?? null],
        enabled: !!organizerId && !!currencyCode,
        placeholderData: keepPreviousData,
        queryFn: async () => {
            const {data} = await organizerClient.getOrganizerStats(organizerId, currencyCode as string, periodDays);
            return data;
        }
    });
};
