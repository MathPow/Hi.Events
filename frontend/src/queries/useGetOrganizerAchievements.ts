import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {organizerClient} from "../api/organizer.client.ts";

export const GET_ORGANIZER_ACHIEVEMENTS_QUERY_KEY = 'getOrganizerAchievements';

export const useGetOrganizerAchievements = (organizerId: IdParam) => {
    return useQuery({
        queryKey: [GET_ORGANIZER_ACHIEVEMENTS_QUERY_KEY, organizerId],
        enabled: !!organizerId,
        queryFn: async () => {
            const {data} = await organizerClient.getAchievements(organizerId);
            return data;
        }
    });
};
