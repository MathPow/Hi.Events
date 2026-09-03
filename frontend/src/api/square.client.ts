import {api} from "./client.ts";
import {GenericDataResponse, IdParam} from "../types.ts";

export interface SquareLocation {
    id: string;
    name: string;
    currency: string | null;
    country: string | null;
    is_active: boolean;
}

export interface SquareConnection {
    is_oauth_configured: boolean;
    is_connected: boolean;
    is_setup_complete: boolean;
    environment: string | null;
    merchant_id: string | null;
    merchant_name: string | null;
    location_id: string | null;
    currency: string | null;
    country: string | null;
    connected_at: string | null;
    locations: SquareLocation[];
}

export const squareClient = {
    getConnection: async (accountId: IdParam) => {
        const response = await api.get<GenericDataResponse<SquareConnection>>(
            `accounts/${accountId}/square`
        );
        return response.data;
    },

    createAuthorizationUrl: async (accountId: IdParam) => {
        const response = await api.post<GenericDataResponse<{ authorize_url: string }>>(
            `accounts/${accountId}/square/authorize`
        );
        return response.data;
    },

    completeAuthorization: async (accountId: IdParam, data: { code: string, state: string }) => {
        const response = await api.post<GenericDataResponse<SquareConnection>>(
            `accounts/${accountId}/square/connect`,
            data
        );
        return response.data;
    },

    updateLocation: async (accountId: IdParam, locationId: string) => {
        const response = await api.put<GenericDataResponse<SquareConnection>>(
            `accounts/${accountId}/square/location`,
            {location_id: locationId}
        );
        return response.data;
    },

    disconnect: async (accountId: IdParam) => {
        const response = await api.delete(`accounts/${accountId}/square`);
        return response.data;
    },
};
