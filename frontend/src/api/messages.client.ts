import {api} from "./client";
import {GenericPaginatedResponse, IdParam, Message, OutgoingMessage, QueryFilters,} from "../types";
import {queryParamsHelper} from "../utilites/queryParamsHelper.ts";
import {AxiosResponse} from "axios";

export type SendMessageRequest = Partial<Omit<Message, 'attachments'>> & {
    attachments?: File[];
    [key: string]: unknown;
};

const toFormData = (data: SendMessageRequest): FormData => {
    const formData = new FormData();

    Object.entries(data).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item) => formData.append(`${key}[]`, item instanceof File ? item : String(item)));
            return;
        }
        if (typeof value === 'boolean') {
            formData.append(key, value ? '1' : '0');
            return;
        }
        formData.append(key, String(value));
    });

    return formData;
};

export const messagesClient = {
    send: async (eventId: IdParam, messagesRequest: SendMessageRequest) => {
        if (!messagesRequest.attachments?.length) {
            const {attachments: _attachments, ...jsonRequest} = messagesRequest;
            return await api.post(`events/${eventId}/messages`, jsonRequest);
        }

        return await api.post(`events/${eventId}/messages`, toFormData(messagesRequest), {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    all: async (eventId: IdParam, pagination: QueryFilters) => {
        const response: AxiosResponse<GenericPaginatedResponse<Message>> = await api.get<GenericPaginatedResponse<Message>>(
            `events/${eventId}/messages` + queryParamsHelper.buildQueryString(pagination),
        );
        return response.data;
    },
    cancel: async (eventId: IdParam, messageId: IdParam) => {
        return await api.post(`events/${eventId}/messages/${messageId}/cancel`);
    },
    recipients: async (eventId: IdParam, messageId: IdParam, pagination: QueryFilters) => {
        const response: AxiosResponse<GenericPaginatedResponse<OutgoingMessage>> = await api.get<GenericPaginatedResponse<OutgoingMessage>>(
            `events/${eventId}/messages/${messageId}/recipients` + queryParamsHelper.buildQueryString(pagination),
        );
        return response.data;
    },
}
