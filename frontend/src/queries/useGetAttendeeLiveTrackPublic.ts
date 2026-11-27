import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {liveTrackClientPublic} from "../api/liveTrack.client.ts";

export const GET_ATTENDEE_LIVE_TRACK_PUBLIC_QUERY_KEY = 'getAttendeeLiveTrackPublic';

// While the link waits for the start or the participant is on the course, the card follows along.
export const useGetAttendeeLiveTrackPublic = (eventId: IdParam, attendeeShortId: string | undefined) => {
    return useQuery({
        queryKey: [GET_ATTENDEE_LIVE_TRACK_PUBLIC_QUERY_KEY, eventId, attendeeShortId],
        queryFn: async () => (await liveTrackClientPublic.get(eventId, attendeeShortId!)).data,
        enabled: !!eventId && !!attendeeShortId,
        refetchOnWindowFocus: false,
        retry: false,
        refetchInterval: (query) => {
            const status = query.state.data?.live_track?.status;
            return status === 'WAITING' || status === 'ACTIVE' ? 30000 : false;
        },
    });
};
