import {api} from "./client";
import {GenericDataResponse, IdParam} from "../types";

export interface BibNumberStart {
    product_price_id: IdParam;
    bib_number_start: number | null;
}

export const bibNumberClient = {
    updateStarts: async (eventId: IdParam, starts: BibNumberStart[]) => {
        const response = await api.put<GenericDataResponse<{ starts: BibNumberStart[] }>>(`events/${eventId}/bib-numbers`, {starts});
        return response.data;
    },
    assign: async (eventId: IdParam) => {
        const response = await api.post<GenericDataResponse<{ assigned: number }>>(`events/${eventId}/bib-numbers/assign`);
        return response.data;
    },
}
