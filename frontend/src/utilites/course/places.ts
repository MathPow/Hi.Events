/* eslint-disable lingui/no-unlocalized-strings -- technical strings: URLs, XML, map style keys */
import {haversine, LatLng} from "./geo.ts";
import {natureOf} from "./routing.ts";
import type {TrailWay} from "./trailGraph.ts";

// Address search (Photon, OpenStreetMap data) and the trails around a point: our own tiles of Québec's
// trails first, Overpass elsewhere or when ours fail. Every call has a timeout and failing is never fatal.

export interface PlaceResult {
    label: string;
    position: LatLng;
}

interface PhotonFeature {
    geometry: { coordinates: [number, number] };
    properties: {
        name?: string;
        housenumber?: string;
        street?: string;
        city?: string;
        state?: string;
        postcode?: string;
    };
}

interface OverpassWay {
    geometry?: { lat: number; lon: number }[];
    tags?: Record<string, string>;
}

const PHOTON_URL = 'https://photon.komoot.io/api';
const OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
];

const placeLabel = (props: PhotonFeature['properties']): string => {
    const street = props.housenumber && props.street ? `${props.housenumber} ${props.street}` : props.street;
    const parts = [
        props.name && props.name !== props.street ? props.name : undefined,
        street,
        props.city,
        props.state,
    ].filter((part): part is string => !!part);

    return [...new Set(parts)].join(', ');
};

/** Places matching `query`, the closest to `near` first. */
export const searchPlaces = async (query: string, near?: LatLng, language = 'fr'): Promise<PlaceResult[]> => {
    const params = new URLSearchParams({q: query, limit: '6', lang: ['fr', 'en', 'de', 'it'].includes(language) ? language : 'en'});
    if (near) {
        params.set('lat', near.lat.toFixed(4));
        params.set('lon', near.lng.toFixed(4));
    }

    try {
        const response = await fetch(`${PHOTON_URL}?${params}`, {signal: AbortSignal.timeout(8000)});
        if (!response.ok) {
            return [];
        }
        const data = await response.json() as { features?: PhotonFeature[] };

        return (data.features ?? [])
            .map((feature) => ({
                label: placeLabel(feature.properties),
                position: {lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0]},
            }))
            .filter((place) => place.label !== '');
    } catch {
        return [];
    }
};

// Québec's trails cut in tiles of 0.05° on our own server (the dehors-trails container, made every month
// from OpenStreetMap, sidewalks left out): one tile is [highway, surface, lat, lng, Δlat, Δlng, …] per
// way, in millionths of a degree, each point after the first as a step from the one before.
const TILES_PER_DEGREE = 20;
const MAX_TILES = 30;

const decodeWay = ([highway, surface, ...steps]: (string | number)[]): TrailWay => {
    const points: LatLng[] = [];
    let lat = 0;
    let lng = 0;
    for (let i = 0; i + 1 < steps.length; i += 2) {
        lat += steps[i] as number;
        lng += steps[i + 1] as number;
        points.push({lat: lat / 1e6, lng: lng / 1e6});
    }
    return {points, nature: natureOf(String(highway), surface ? String(surface) : undefined)};
};

// The ways of one tile, null when there is none (no trail there, or outside Québec), undefined when
// the server failed.
const tileWays = async (y: number, x: number): Promise<TrailWay[] | null | undefined> => {
    try {
        const response = await fetch(`${window.location.origin}/trails/${y}/${x}.json`, {signal: AbortSignal.timeout(10000)});
        if (response.status === 404) {
            return null;
        }
        if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) {
            return undefined;
        }
        const data = await response.json() as { w?: (string | number)[][] };
        return (data.w ?? []).map(decodeWay);
    } catch {
        return undefined;
    }
};

const ownTrailWays = async (center: LatLng, radiusM: number): Promise<TrailWay[] | null> => {
    if (typeof window === 'undefined') {
        return null;
    }
    const dLat = radiusM / 110540;
    const dLng = radiusM / (111320 * Math.cos((center.lat * Math.PI) / 180));
    const tiles: [number, number][] = [];
    for (let y = Math.floor((center.lat - dLat) * TILES_PER_DEGREE); y <= Math.floor((center.lat + dLat) * TILES_PER_DEGREE); y++) {
        for (let x = Math.floor((center.lng - dLng) * TILES_PER_DEGREE); x <= Math.floor((center.lng + dLng) * TILES_PER_DEGREE); x++) {
            tiles.push([y, x]);
        }
    }
    if (tiles.length > MAX_TILES) {
        return null;
    }

    const found = await Promise.all(tiles.map(([y, x]) => tileWays(y, x)));
    if (found.some((ways) => ways === undefined) || found.every((ways) => ways === null)) {
        return null;
    }

    return found.flatMap((ways) => ways ?? []).filter((way) => way.points.some((p) => haversine(p, center) <= radiusM));
};

/** The trails and paths within `radiusM` of `center`, sidewalks left out; empty when none could be had. */
export const fetchTrailWays = async (center: LatLng, radiusM: number): Promise<TrailWay[]> => (
    await ownTrailWays(center, radiusM) ?? overpassTrailWays(center, radiusM)
);

const overpassTrailWays = async (center: LatLng, radiusM: number): Promise<TrailWay[]> => {
    const around = `${Math.round(radiusM)},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
    const query = `[out:json][timeout:20];
(
  way["highway"~"^(path|track|footway|bridleway|steps)$"]["footway"!~"^(sidewalk|crossing|traffic_island|link)$"]["access"!~"^(private|no)$"](around:${around});
  way["highway"~"^(cycleway|pedestrian)$"]["foot"!="no"]["access"!~"^(private|no)$"](around:${around});
);
out tags geom;`;

    // Every mirror at once: each one is slow or down now and then, the first good answer wins.
    const done = new AbortController();
    const ask = async (url: string): Promise<OverpassWay[]> => {
        const response = await fetch(url, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            signal: AbortSignal.any([done.signal, AbortSignal.timeout(15000)]),
        });
        const data = response.ok ? await response.json() : undefined;
        if (!Array.isArray(data?.elements)) {
            throw new Error(`Overpass ${response.status}`);
        }
        return data.elements;
    };

    try {
        const elements = await Promise.any(OVERPASS_URLS.map(ask));
        done.abort();
        return elements
            .filter((element) => (element.geometry?.length ?? 0) > 1)
            .map((element) => ({
                points: (element.geometry ?? []).map((g) => ({lat: g.lat, lng: g.lon})),
                nature: natureOf(element.tags?.highway ?? '', element.tags?.surface),
            }));
    } catch {
        return [];
    }
};

/** The trail point nearest to `p` when one is within `maxM`, else `p` itself. */
export const snapToTrail = (p: LatLng, trailPoints: LatLng[], maxM = 250): LatLng => {
    let best: LatLng | null = null;
    let bestDistance = maxM;
    for (const candidate of trailPoints) {
        const distance = haversine(p, candidate);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = candidate;
        }
    }

    return best ?? p;
};
