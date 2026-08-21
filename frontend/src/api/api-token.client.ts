import {api} from "./client.ts";
import {IdParam} from "../types.ts";

export interface ApiToken {
    id: number;
    name: string;
    last_used_at: string | null;
    expires_at: string | null;
    created_at: string;
}

export interface CreatedApiToken {
    id: number;
    name: string;
    expires_at: string | null;
    /** Visible une seule fois, a la creation. Rien ne permet de le retrouver ensuite. */
    token: string;
}

export const apiTokenClient = {
    all: async () => {
        const response = await api.get<{ data: ApiToken[] }>('api-tokens');
        return response.data;
    },

    create: async (payload: { name: string; expires_at?: string | null }) => {
        const response = await api.post<{ data: CreatedApiToken }>('api-tokens', payload);
        return response.data;
    },

    delete: async (tokenId: IdParam) => {
        const response = await api.delete(`api-tokens/${tokenId}`);
        return response.data;
    },
};
