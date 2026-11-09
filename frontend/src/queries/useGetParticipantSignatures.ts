import {useQuery} from "@tanstack/react-query";
import {AxiosError} from "axios";
import {IdParam} from "../types.ts";
import {participantSignatureClientPublic, PendingSignatures} from "../api/participantSignature.client.ts";

export const GET_PARTICIPANT_SIGNATURES_QUERY_KEY = 'getParticipantSignatures';

export const useGetParticipantSignatures = (eventId: IdParam, attendeeShortId: string) => {
    return useQuery<PendingSignatures, AxiosError>({
        queryKey: [GET_PARTICIPANT_SIGNATURES_QUERY_KEY, eventId, attendeeShortId],
        queryFn: () => participantSignatureClientPublic.getForTicket(eventId, attendeeShortId),
        refetchOnWindowFocus: false,
        retry: false,
    });
};
