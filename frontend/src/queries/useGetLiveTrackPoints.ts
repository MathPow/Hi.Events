import {useQuery} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {liveTrackClient} from "../api/liveTrack.client.ts";
import {LIVE_TRACKS_REFRESH_MS} from "./useGetEventLiveTracks.ts";

export const GET_LIVE_TRACK_POINTS_QUERY_KEY = 'getLiveTrackPoints';

export const useGetLiveTrackPoints = (eventId: IdParam, liveTrackId: IdParam | null) => {
    return useQuery({
        queryKey: [GET_LIVE_TRACK_POINTS_QUERY_KEY, eventId, liveTrackId],
        queryFn: async () => (await liveTrackClient.points(eventId, liveTrackId!)).data,
        enabled: !!eventId && !!liveTrackId,
        refetchInterval: LIVE_TRACKS_REFRESH_MS,
        refetchIntervalInBackground: false,
    });
};
