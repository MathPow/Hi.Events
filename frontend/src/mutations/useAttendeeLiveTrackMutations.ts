import {useMutation, useQueryClient} from "@tanstack/react-query";
import {IdParam} from "../types.ts";
import {AttendeeLiveTrackPublic, liveTrackClientPublic} from "../api/liveTrack.client.ts";
import {GET_ATTENDEE_LIVE_TRACK_PUBLIC_QUERY_KEY} from "../queries/useGetAttendeeLiveTrackPublic.ts";

export const useShareLiveTrack = (eventId: IdParam, attendeeShortId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({link, consent}: { link: string; consent: boolean }) =>
            liveTrackClientPublic.share(eventId, attendeeShortId, link, consent),
        onSuccess: ({data}) => {
            queryClient.setQueryData<AttendeeLiveTrackPublic>(
                [GET_ATTENDEE_LIVE_TRACK_PUBLIC_QUERY_KEY, eventId, attendeeShortId],
                (previous) => ({enabled: previous?.enabled ?? true, live_track: data}),
            );
        },
    });
};

export const useRemoveLiveTrack = (eventId: IdParam, attendeeShortId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: () => liveTrackClientPublic.remove(eventId, attendeeShortId),
        onSuccess: () => {
            queryClient.setQueryData<AttendeeLiveTrackPublic>(
                [GET_ATTENDEE_LIVE_TRACK_PUBLIC_QUERY_KEY, eventId, attendeeShortId],
                (previous) => ({enabled: previous?.enabled ?? true, live_track: null}),
            );
        },
    });
};
