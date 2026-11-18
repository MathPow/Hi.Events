import {api} from "./client";
import {publicApi} from "./public-client.ts";
import {IdParam} from "../types";

export type EventChangeRefundStatus =
    'PENDING'
    | 'REFUNDED'
    | 'CANCELLED_NO_PAYMENT'
    | 'MANUAL_REFUND_REQUIRED'
    | 'NOT_REFUNDED'
    | 'SKIPPED'
    | 'FAILED';

export interface EventDateChange {
    id: number;
    old_start_date: string;
    old_end_date: string | null;
    new_start_date: string;
    new_end_date: string | null;
    refunds_allowed: boolean;
    refund_deadline: string | null;
    recipients_count: number;
    refunds_count: number;
    created_at: string;
}

export interface EventCancellationState {
    id: number;
    refund_orders: boolean;
    recipients_count: number;
    created_at: string;
    counts: Record<EventChangeRefundStatus, number>;
}

export interface EventChangeRefundToCheck {
    order_id: number;
    order_public_id: string | null;
    buyer_name: string | null;
    buyer_email: string | null;
    status: EventChangeRefundStatus;
    amount: number;
    currency: string | null;
    error: string | null;
    source: 'POSTPONEMENT' | 'CANCELLATION';
}

// The card « Mauvaise météo ? ».
export interface EventChangeStatus {
    cancelled_at: string | null;
    audience: {
        orders: number;
        recipients: number;
        paid_online_orders: number;
        paid_offline_orders: number;
        unpaid_orders: number;
    };
    date_changes: EventDateChange[];
    cancellation: EventCancellationState | null;
    refunds_to_check: EventChangeRefundToCheck[];
}

// Wall-clock dates of the event (« 2026-11-21T09:00 »), as DateTimeField gives them.
export interface PostponeEventRequest {
    start_date: string;
    end_date: string | null;
    message: string;
    refunds_allowed: boolean;
    refund_deadline: string | null;
}

export interface CancelEventRequest {
    message: string;
    refund_orders: boolean;
    confirmed: boolean;
}

export type RefundMethod = 'ONLINE' | 'OFFLINE' | 'NONE';

// The page « Je ne peux plus venir : me faire rembourser ».
export interface RefundRequest {
    event_title: string;
    event_start_date: string;
    event_end_date: string | null;
    event_timezone: string;
    old_start_date: string;
    organizer_name: string | null;
    support_email: string | null;
    order_public_id: string;
    buyer_first_name: string | null;
    buyer_last_name: string | null;
    total_gross: number;
    refundable_amount: number;
    currency: string;
    refund_method: RefundMethod;
    refund_deadline: string | null;
    refusal: string | null;
    refusal_message: string | null;
    outcome: EventChangeRefundStatus | null;
}

export const eventChangeClient = {
    getStatus: async (eventId: IdParam) => {
        const response = await api.get<{ data: EventChangeStatus }>(`events/${eventId}/weather`);
        return response.data.data;
    },
    postpone: async (eventId: IdParam, request: PostponeEventRequest) => {
        const response = await api.post<{ data: EventChangeStatus }>(`events/${eventId}/postpone`, request);
        return response.data.data;
    },
    cancel: async (eventId: IdParam, request: CancelEventRequest) => {
        const response = await api.post<{ data: EventChangeStatus }>(`events/${eventId}/cancel`, request);
        return response.data.data;
    },
};

export const refundRequestClientPublic = {
    get: async (eventId: IdParam, orderShortId: string, change: string, token: string) => {
        const response = await publicApi.get<{ data: RefundRequest }>(
            `events/${eventId}/order/${orderShortId}/refund-request`,
            {params: {change, token}},
        );
        return response.data.data;
    },
    submit: async (eventId: IdParam, orderShortId: string, change: string, token: string) => {
        const response = await publicApi.post<{ data: RefundRequest }>(
            `events/${eventId}/order/${orderShortId}/refund-request`,
            {change, token},
        );
        return response.data.data;
    },
};
