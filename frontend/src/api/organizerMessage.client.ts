import {api} from "./client";
import {IdParam, PaginationData} from "../types.ts";

// Un message du bouton « Contacter » des pages publiques (organisateur ou evenement).
export interface OrganizerMessage {
    id: number;
    organizer_id: number;
    event_id: number | null;
    event: { id: number; title: string; slug: string } | null;
    sender_name: string;
    sender_email: string;
    message: string;
    read_at: string | null;
    created_at: string;
}

export interface OrganizerMessagesResponse {
    data: OrganizerMessage[];
    meta: PaginationData & { unread_count: number };
}

export const organizerMessageClient = {
    list: async (organizerId: IdParam, page: number, unreadOnly: boolean) => {
        const response = await api.get<OrganizerMessagesResponse>(
            `organizers/${organizerId}/messages?page=${page}&per_page=20${unreadOnly ? '&unread=1' : ''}`
        );
        return response.data;
    },

    unreadCount: async (organizerId: IdParam) => {
        const response = await api.get<{ unread_count: number }>(`organizers/${organizerId}/messages/unread-count`);
        return response.data.unread_count;
    },

    setRead: async (organizerId: IdParam, messageId: IdParam, read: boolean) => {
        const response = await api.patch<{ data: OrganizerMessage }>(`organizers/${organizerId}/messages/${messageId}`, {read});
        return response.data.data;
    },

    markAllRead: async (organizerId: IdParam) => {
        await api.post(`organizers/${organizerId}/messages/read-all`);
    },

    remove: async (organizerId: IdParam, messageId: IdParam) => {
        await api.delete(`organizers/${organizerId}/messages/${messageId}`);
    },
};

// Les notifications Web Push de l'utilisateur connecte (un abonnement par appareil).
export const pushClient = {
    publicKey: async () => {
        const response = await api.get<{ public_key: string }>('push/public-key');
        return response.data.public_key;
    },

    subscribe: async (subscription: PushSubscriptionJSON) => {
        await api.post('push/subscriptions', {
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            content_encoding: 'aes128gcm',
        });
    },

    unsubscribe: async (endpoint: string) => {
        await api.delete('push/subscriptions', {data: {endpoint}});
    },
};
