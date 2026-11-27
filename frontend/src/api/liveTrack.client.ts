import {api} from "./client.ts";
import {publicApi} from "./public-client.ts";
import {GenericDataResponse, IdParam} from "../types.ts";

// « Suivi en direct »: a participant shares their Garmin LiveTrack link from their ticket, the
// billetterie reads their position every minute and the organizer sees everyone on the course.

export type LiveTrackStatus = 'WAITING' | 'ACTIVE' | 'ENDED' | 'FAILED';

export interface LiveTrack {
    id: number;
    attendee_id: number;
    attendee: {
        first_name: string;
        last_name: string;
        public_id: string;
        bib_number: number | null;
        product_id: number;
        product_title: string | null;
    } | null;
    status: LiveTrackStatus;
    last_error: string | null;
    shared_at: string;
    last_polled_at: string | null;
    last_point_at: string | null;
    still_since: string | null;
    latitude: number | null;
    longitude: number | null;
    altitude_m: number | null;
    speed_mps: number | null;
    distance_m: number | null;
    duration_s: number | null;
    elevation_gain_m: number | null;
    heart_rate: number | null;
    cadence: number | null;
    share_url: string;
}

export interface LiveTrackPoint {
    recorded_at: string;
    latitude: number;
    longitude: number;
    altitude_m: number | null;
    heart_rate: number | null;
}

export interface LiveTrackPublic {
    status: LiveTrackStatus;
    last_error: string | null;
    last_point_at: string | null;
    distance_m: number | null;
    duration_s: number | null;
    shared_at: string;
}

export interface AttendeeLiveTrackPublic {
    enabled: boolean;
    live_track: LiveTrackPublic | null;
}

export const liveTrackClient = {
    all: async (eventId: IdParam) => {
        const response = await api.get<GenericDataResponse<LiveTrack[]>>(`events/${eventId}/live-tracks`);
        return response.data;
    },
    points: async (eventId: IdParam, liveTrackId: IdParam) => {
        const response = await api.get<GenericDataResponse<LiveTrackPoint[]>>(`events/${eventId}/live-tracks/${liveTrackId}/points`);
        return response.data;
    },
};

export const liveTrackClientPublic = {
    get: async (eventId: IdParam, attendeeShortId: string) => {
        const response = await publicApi.get<GenericDataResponse<AttendeeLiveTrackPublic>>(`events/${eventId}/attendees/${attendeeShortId}/live-track`);
        return response.data;
    },
    share: async (eventId: IdParam, attendeeShortId: string, link: string, consent: boolean) => {
        const response = await publicApi.put<GenericDataResponse<LiveTrackPublic>>(`events/${eventId}/attendees/${attendeeShortId}/live-track`, {link, consent});
        return response.data;
    },
    remove: async (eventId: IdParam, attendeeShortId: string) => {
        await publicApi.delete(`events/${eventId}/attendees/${attendeeShortId}/live-track`);
    },
};

// The guide that explains how to start LiveTrack and share the link (help center).
export const LIVE_TRACK_GUIDE_PATH = '/help/suivi-en-direct-garmin';
