/* eslint-disable lingui/no-unlocalized-strings -- technical strings: URLs, XML, map style keys */
import {elevationGain, LatLng, pathDistance, TrackPoint} from "./geo.ts";

// Routing through BRouter, like UltraTalesTrack: a line through the given points that follows real
// trails and streets, with the elevation of each point. Our own BRouter first (/brouter on the site,
// the dehors-brouter container), the public brouter.de when ours doesn't answer.

export type CourseSurface = 'trail' | 'mixed' | 'road';

const PROFILES: Record<CourseSurface, string> = {
    trail: 'hiking-mountain',
    mixed: 'trekking',
    road: 'fastbike',
};

const PUBLIC_BROUTER_URL = 'https://brouter.de/brouter';
// A point BRouter can't reach (a lake, a forest without paths) makes it search for long: give up instead.
const TIMEOUT_MS = 12000;
// BRouter stops its oldest request past a few at once: a handful at a time, never a burst.
const MAX_PARALLEL = 3;
// After our server fails, the public one for a minute instead of trying ours on every request.
const OWN_SERVER_PAUSE_MS = 60000;

export interface RoutedLine {
    points: TrackPoint[];
    distance: number;
    ascent: number;
}

let running = 0;
const waiting: (() => void)[] = [];
let ownServerDownUntil = 0;

const slot = async () => {
    if (running >= MAX_PARALLEL) {
        await new Promise<void>((resolve) => waiting.push(resolve));
    }
    running++;
};

const release = () => {
    running--;
    waiting.shift()?.();
};

const ownServerUrl = (): string | null => (
    typeof window === 'undefined' || Date.now() < ownServerDownUntil ? null : `${window.location.origin}/brouter`
);

// A 2xx with a route, null when BRouter answered that there is none, undefined when the server failed.
const ask = async (baseUrl: string, query: string, signal?: AbortSignal): Promise<RoutedLine | null | undefined> => {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetch(`${baseUrl}?${query}`, {signal: signal ? AbortSignal.any([signal, timeout]) : timeout});
    } catch (error) {
        if (signal?.aborted) {
            throw error;
        }
        // Too long is no route, not a server down.
        return timeout.aborted ? null : undefined;
    }

    // BRouter says « no route » with a 400 and a message; anything else is the server failing.
    if (response.status === 400) {
        return null;
    }
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) {
        return undefined;
    }

    try {
        const data = await response.json();
        const feature = data?.features?.[0];
        const coordinates: number[][] | undefined = feature?.geometry?.coordinates;
        if (!coordinates || coordinates.length < 2) {
            return null;
        }

        const points: TrackPoint[] = coordinates.map(([lng, lat, ele]) => (
            ele === undefined ? {lat, lng} : {lat, lng, ele}
        ));
        const reported = parseFloat(feature.properties?.['track-length'] ?? '');
        const ascent = parseFloat(feature.properties?.['filtered ascend'] ?? '');

        return {
            points,
            distance: Number.isFinite(reported) && reported > 0 ? reported : pathDistance(points),
            ascent: Number.isFinite(ascent) ? Math.round(ascent) : elevationGain(points),
        };
    } catch {
        return undefined;
    }
};

/** The routed line through `via` (at least 2 points), or null when no route was found. */
export const routeThrough = async (via: LatLng[], surface: CourseSurface, signal?: AbortSignal): Promise<RoutedLine | null> => {
    if (via.length < 2) {
        return null;
    }

    const lonlats = via.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join('|');
    const query = `lonlats=${lonlats}&profile=${PROFILES[surface]}&alternativeidx=0&format=geojson`;

    await slot();
    try {
        // Ours only holds Québec: no route there can also mean a place outside it, so the public one tries too.
        const own = ownServerUrl();
        if (own) {
            const result = await ask(own, query, signal);
            if (result) {
                return result;
            }
            if (result === undefined) {
                ownServerDownUntil = Date.now() + OWN_SERVER_PAUSE_MS;
            }
        }

        return (await ask(PUBLIC_BROUTER_URL, query, signal)) ?? null;
    } finally {
        release();
    }
};
