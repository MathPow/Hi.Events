import {api} from "./client.ts";
import {publicApi} from "./public-client.ts";
import {GenericDataResponse, IdParam} from "../types.ts";
import {getConfig} from "../utilites/config.ts";
import {intlLocale} from "../utilites/intlLocale.ts";

// A GPX course of an event (« 10 km »), downloaded by participants from their ticket.
export interface EventRouteFile {
    id: number;
    event_id: number;
    label: string;
    original_filename: string;
    size: number;
    download_url: string;
    created_at: string;
}

export type EventRouteFilePublic = Pick<EventRouteFile, 'id' | 'label' | 'size' | 'download_url'>;

export const MAX_ROUTE_FILES_PER_EVENT = 5;
export const MAX_ROUTE_FILE_BYTES = 10 * 1024 * 1024;

export const eventRouteFileClient = {
    all: async (eventId: IdParam) => {
        const response = await api.get<GenericDataResponse<EventRouteFile[]>>(`events/${eventId}/route-files`);
        return response.data;
    },
    upload: async (eventId: IdParam, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post<GenericDataResponse<EventRouteFile>>(`events/${eventId}/route-files`, formData, {
            headers: {'Content-Type': 'multipart/form-data'},
        });
        return response.data;
    },
    rename: async (eventId: IdParam, routeFileId: IdParam, label: string) => {
        const response = await api.patch<GenericDataResponse<EventRouteFile>>(`events/${eventId}/route-files/${routeFileId}`, {label});
        return response.data;
    },
    delete: async (eventId: IdParam, routeFileId: IdParam) => {
        await api.delete(`events/${eventId}/route-files/${routeFileId}`);
    },
};

export const eventRouteFileClientPublic = {
    all: async (eventId: IdParam) => {
        const response = await publicApi.get<GenericDataResponse<EventRouteFilePublic[]>>(`events/${eventId}/route-files`);
        return response.data;
    },
    // A plain link: the browser saves the file under the course's name (Content-Disposition).
    downloadUrl: (eventId: IdParam, routeFileId: IdParam): string =>
        `${getConfig('VITE_API_URL_CLIENT')}/public/events/${eventId}/route-files/${routeFileId}`,
};

// « 1,2 Mo », « 850 ko »: the size in the page's language.
export const formatRouteFileSize = (bytes: number): string => {
    const megabytes = bytes / (1024 * 1024);
    const [value, unit] = megabytes >= 1
        ? [megabytes, 'megabyte']
        : [Math.max(1, Math.round(bytes / 1024)), 'kilobyte'];

    return new Intl.NumberFormat(intlLocale(), {style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1}).format(value);
};
