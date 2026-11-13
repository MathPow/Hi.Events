import {publicApi} from "./public-client.ts";
import {IdParam, Question} from "../types.ts";

export type TicketTransferRefusal =
    'DISABLED'
    | 'DEADLINE_PASSED'
    | 'ORDER_NOT_COMPLETED'
    | 'TICKET_NOT_ACTIVE'
    | 'CHECKED_IN'
    | 'SAME_EMAIL';

// Whether a ticket can be given to someone else now, and until when (UTC).
export interface TicketTransferEligibility {
    enabled: boolean;
    can_transfer: boolean;
    deadline: string | null;
    refusal: TicketTransferRefusal | null;
    refusal_message: string | null;
}

export interface TicketTransferRecipient {
    first_name: string;
    last_name: string;
    email: string;
    email_confirmation: string;
}

// The new holder's own answers to the participant form, in the checkout's shape.
export interface HolderDetailsInput {
    questions: { question_id: IdParam, response: Record<string, unknown> }[];
}

export const ticketTransferClientPublic = {
    getEligibility: async (eventId: IdParam, attendeeShortId: string) => {
        const response = await publicApi.get<{ data: TicketTransferEligibility }>(`events/${eventId}/attendees/${attendeeShortId}/transfer`);
        return response.data.data;
    },
    transfer: async (eventId: IdParam, attendeeShortId: string, recipient: TicketTransferRecipient) => {
        const response = await publicApi.post<{ message: string }>(`events/${eventId}/attendees/${attendeeShortId}/transfer`, recipient);
        return response.data;
    },
    // The participant details the new holder of a transferred ticket has yet to give.
    getPendingDetails: async (eventId: IdParam, attendeeShortId: string) => {
        const response = await publicApi.get<{ data: Question[] }>(`events/${eventId}/attendees/${attendeeShortId}/details`);
        return response.data.data;
    },
    saveDetails: async (eventId: IdParam, attendeeShortId: string, input: HolderDetailsInput) => {
        await publicApi.post(`events/${eventId}/attendees/${attendeeShortId}/details`, input);
    },
};
