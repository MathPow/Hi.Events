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
// Ours has a profile of its own for « Sentiers » (dehors-trail.brf next to BRouter): every metre costs
// 1 + 3 × (1 − natureOf), the same as the planner counts, so it follows the trails a loop was planned on.
const OWN_PROFILES: Record<CourseSurface, string> = {...PROFILES, trail: 'dehors-trail'};

const PUBLIC_BROUTER_URL = 'https://brouter.de/brouter';
// A point BRouter can't reach (a lake, a forest without paths) makes it search for long: give up instead.
const TIMEOUT_MS = 12000;
// BRouter stops its oldest request past a few at once: a handful at a time, never a burst.
const MAX_PARALLEL = 3;
// After our server fails, the public one for a minute instead of trying ours on every request.
const OWN_SERVER_PAUSE_MS = 60000;
// Ours answers 429 to a visitor asking too much at once: wait a moment and ask it again.
const BUSY_RETRIES = 3;
const BUSY_WAIT_MS = 700;

export interface RoutedLine {
    points: TrackPoint[];
    distance: number;
    ascent: number;
    // What the line runs on, from the way tags BRouter lists: how much of its length is on trails (0 to
    // 1, see natureOf), and on busy roads. Unknown when BRouter didn't list them.
    nature?: number;
    busy?: number;
}

const BUSY: Record<string, number> = {
    trunk: 1, trunk_link: 1, primary: 1, primary_link: 1, secondary: 1, secondary_link: 1,
    tertiary: 0.5, tertiary_link: 0.5,
};
const TRAILS = ['path', 'track', 'bridleway', 'steps'];
const PARK_PATHS = ['cycleway', 'pedestrian'];
const STREETS = ['service', 'residential', 'living_street', 'unclassified'];
const PAVED = ['paved', 'asphalt', 'concrete', 'concrete:plates', 'concrete:lanes', 'paving_stones', 'sett', 'cobblestone', 'chipseal', 'metal'];

// How much a stretch feels like a trail, 0 to 1 (dehors-trail.brf on our BRouter counts the same). Cities map their sidewalks as footways: a paved
// footway counts as a sidewalk, an unpaved one as a trail.
export const natureOf = (highway: string, surface: string | undefined): number => {
    const paved = surface === undefined ? undefined : PAVED.includes(surface);
    if (TRAILS.includes(highway)) {
        return paved ? 0.4 : 1;
    }
    // A footway without a surface is most often a park path; sidewalks are tagged as such, or paved.
    if (highway === 'footway') {
        return paved === undefined ? 0.7 : paved ? 0.3 : 1;
    }
    // A paved bike path runs along a boulevard as often as through a park.
    if (PARK_PATHS.includes(highway)) {
        return paved === false ? 0.8 : 0.3;
    }
    if (BUSY[highway]) {
        return 0;
    }
    if (paved === false) {
        return 0.6;
    }
    return STREETS.includes(highway) ? 0.1 : 0;
};

// BRouter's « messages »: a header row, then one row per stretch with its length and its way tags.
const readWays = (messages: unknown): { nature: number; busy: number } | undefined => {
    if (!Array.isArray(messages) || messages.length < 2) {
        return undefined;
    }
    const header = messages[0] as string[];
    const lengthAt = header.indexOf('Distance');
    const tagsAt = header.indexOf('WayTags');
    if (lengthAt < 0 || tagsAt < 0) {
        return undefined;
    }

    let total = 0;
    let nature = 0;
    let busy = 0;
    for (const row of messages.slice(1) as string[][]) {
        const length = Number(row[lengthAt]);
        const tags = String(row[tagsAt] ?? '');
        const highway = /(?:^|\s)highway=([a-z_]+)/.exec(tags)?.[1] ?? '';
        const surface = /(?:^|\s)surface=([a-z_:]+)/.exec(tags)?.[1];
        if (!Number.isFinite(length) || length <= 0) {
            continue;
        }
        total += length;
        nature += length * natureOf(highway, surface);
        busy += length * (BUSY[highway] ?? 0);
    }

    return total > 0 ? {nature: nature / total, busy: busy / total} : undefined;
};

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

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
    }, {once: true});
});

const ownServerUrl = (): string | null => (
    typeof window === 'undefined' || Date.now() < ownServerDownUntil ? null : `${window.location.origin}/brouter`
);

// A 2xx with a route, null when BRouter answered that there is none, 'busy' for too many requests at
// once, undefined when the server failed.
const ask = async (baseUrl: string, query: string, signal?: AbortSignal): Promise<RoutedLine | null | undefined | 'busy'> => {
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
    if (response.status === 429) {
        return 'busy';
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
            ...readWays(feature.properties?.messages),
        };
    } catch {
        return undefined;
    }
};

// Requests of one search (its signal) that no server answered (down, offline): a search that finds
// nothing because of them says so, instead of « no route from here ».
const unanswered = new WeakMap<AbortSignal, number>();
export const unansweredRoutingRequests = (signal: AbortSignal) => unanswered.get(signal) ?? 0;

/** The routed line through `via` (at least 2 points), or null when no route was found. */
export const routeThrough = async (via: LatLng[], surface: CourseSurface, signal?: AbortSignal): Promise<RoutedLine | null> => {
    if (via.length < 2) {
        return null;
    }

    const lonlats = via.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join('|');
    const query = (profile: string) => `lonlats=${lonlats}&profile=${profile}&alternativeidx=0&format=geojson`;

    await slot();
    try {
        // Ours only holds Québec: no route there can also mean a place outside it, so the public one tries too.
        const own = ownServerUrl();
        if (own) {
            let result = await ask(own, query(OWN_PROFILES[surface]), signal);
            for (let retry = 1; result === 'busy' && retry <= BUSY_RETRIES; retry++) {
                await wait(BUSY_WAIT_MS * retry, signal);
                result = await ask(own, query(OWN_PROFILES[surface]), signal);
            }
            if (result && result !== 'busy') {
                return result;
            }
            if (result === undefined) {
                ownServerDownUntil = Date.now() + OWN_SERVER_PAUSE_MS;
            }
        }

        const result = await ask(PUBLIC_BROUTER_URL, query(PROFILES[surface]), signal);
        if (result === undefined && signal) {
            unanswered.set(signal, (unanswered.get(signal) ?? 0) + 1);
        }

        return result && result !== 'busy' ? result : null;
    } finally {
        release();
    }
};
