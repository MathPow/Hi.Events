import {publicApi} from "./public-client";
import {IdParam} from "../types";
import {DocumentAudience, DocumentBlock} from "./organizerDocument.client.ts";
import {checkInPinHeaders} from "../utilites/checkInPin.ts";

// La copie d'un document en ligne qu'un participant a encore a signer.
export interface PendingDocumentCopy {
    id: number;
    title: string;
    blocks: DocumentBlock[];
    audience: DocumentAudience;
    auto_values: Partial<Record<string, string>>;
    is_minor: boolean;
}

// Ce qu'un participant a encore a signer apres l'achat.
export interface PendingSignatures {
    // La decharge de l'evenement, s'il ne l'a pas encore signee.
    waiver_text: string | null;
    waiver_is_minor: boolean;
    documents: PendingDocumentCopy[];
}

export interface ParticipantSignatureInput {
    waiver?: { accepted: boolean, signed_name: string, guardian_name: string };
    // Par id de copie.
    documents?: Record<number, { accepted: boolean, answers: Record<string, string | boolean> }>;
}

export const hasPendingSignatures = (pending?: PendingSignatures | null) =>
    !!pending && (!!pending.waiver_text || pending.documents.length > 0);

export const participantSignatureClientPublic = {
    // Depuis le lien du billet du participant.
    getForTicket: async (eventId: IdParam, attendeeShortId: string) => {
        const response = await publicApi.get<{ data: PendingSignatures }>(`events/${eventId}/attendees/${attendeeShortId}/signatures`);
        return response.data.data;
    },
    signForTicket: async (eventId: IdParam, attendeeShortId: string, input: ParticipantSignatureInput) => {
        await publicApi.post(`events/${eventId}/attendees/${attendeeShortId}/signatures`, input);
    },
    // A l'entree, sur l'appareil du benevole.
    getForCheckIn: async (checkInListShortId: IdParam, attendeePublicId: string) => {
        const response = await publicApi.get<{ data: PendingSignatures }>(
            `/check-in-lists/${checkInListShortId}/attendees/${attendeePublicId}/signatures`,
            {headers: checkInPinHeaders(checkInListShortId)},
        );
        return response.data.data;
    },
    signForCheckIn: async (checkInListShortId: IdParam, attendeePublicId: string, input: ParticipantSignatureInput) => {
        await publicApi.post(
            `/check-in-lists/${checkInListShortId}/attendees/${attendeePublicId}/signatures`,
            input,
            {headers: checkInPinHeaders(checkInListShortId)},
        );
    },
};
