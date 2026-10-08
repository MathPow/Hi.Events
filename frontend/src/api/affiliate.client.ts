import {api} from "./client";
import {publicApi} from "./public-client";
import {
    GenericDataResponse, GenericPaginatedResponse, IdParam, QueryFilters,
} from "../types";
import {queryParamsHelper} from "../utilites/queryParamsHelper.ts";

export interface Affiliate {
    id: number;
    event_id: number;
    account_id: number;
    name: string;
    code: string;
    email?: string;
    total_sales: number;
    total_sales_gross: number;
    status: 'ACTIVE' | 'INACTIVE';
    promo_code_id?: number | null;
    public_token?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateAffiliateRequest {
    name: string;
    code: string;
    email?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    promo_code_id?: string | null;
}

export interface UpdateAffiliateRequest {
    name?: string;
    email?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    promo_code_id?: string | null;
}

export interface AffiliatePartnerPage {
    event_id: number;
    name: string;
    code: string;
    status: 'ACTIVE' | 'INACTIVE';
    promo_code: string | null;
    currency: string;
    orders_count: number;
    tickets_count: number;
    total_gross: number;
}

export const affiliateClient = {
    create: async (eventId: IdParam, affiliate: CreateAffiliateRequest) => {
        const response = await api.post<GenericDataResponse<Affiliate>>(
            `events/${eventId}/affiliates`, affiliate
        );
        return response.data;
    },
    update: async (eventId: IdParam, affiliateId: IdParam, affiliate: UpdateAffiliateRequest) => {
        const response = await api.put<GenericDataResponse<Affiliate>>(
            `events/${eventId}/affiliates/${affiliateId}`, affiliate
        );
        return response.data;
    },
    all: async (eventId: IdParam, pagination: QueryFilters) => {
        const response = await api.get<GenericPaginatedResponse<Affiliate>>(
            `events/${eventId}/affiliates` + queryParamsHelper.buildQueryString(pagination),
        );
        return response.data;
    },
    findById: async (eventId: IdParam, affiliateId: IdParam) => {
        const response = await api.get<GenericDataResponse<Affiliate>>(`events/${eventId}/affiliates/${affiliateId}`);
        return response.data;
    },
    delete: async (eventId: IdParam, affiliateId: IdParam) => {
        const response = await api.delete<GenericDataResponse<Affiliate>>(`events/${eventId}/affiliates/${affiliateId}`);
        return response.data;
    },
    exportAffiliates: async (eventId: IdParam): Promise<Blob> => {
        const response = await api.post(`events/${eventId}/affiliates/export`, {}, {
            responseType: 'blob'
        });
        return response.data;
    },
}

export const affiliateClientPublic = {
    getPartnerPage: async (token: string) => {
        const response = await publicApi.get<GenericDataResponse<AffiliatePartnerPage>>(`affiliates/partner/${token}`);
        return response.data;
    },
}
