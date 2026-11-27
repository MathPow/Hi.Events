import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {liveTrackClient} from "../api/liveTrack.client.ts";

export const GET_EVENT_LIVE_TRACKS_QUERY_KEY = 'getEventLiveTracks';

// The positions are read from Garmin every minute: every 20 s shows a new one soon after.
export const LIVE_TRACKS_REFRESH_MS = 20000;

export const useGetEventLiveTracks = (eventId: IdParam) => {
    return useQuery({
        queryKey: [GET_EVENT_LIVE_TRACKS_QUERY_KEY, eventId],
        queryFn: async () => (await liveTrackClient.all(eventId)).data,
        enabled: !!eventId,
        refetchInterval: LIVE_TRACKS_REFRESH_MS,
        refetchIntervalInBackground: false,
    });
};
