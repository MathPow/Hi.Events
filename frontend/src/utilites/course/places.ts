/* eslint-disable lingui/no-unlocalized-strings -- technical strings: URLs, XML, map style keys */
import {haversine, LatLng} from "./geo.ts";

// Address search (Photon, OpenStreetMap data) and the trails around a point (Overpass), both ported from
// UltraTalesTrack. Free services without keys: every call has a timeout and failing is never fatal.

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

/** Every point of the trails and paths within `radiusM` of `center`; empty when Overpass is unavailable. */
export const fetchTrailPoints = async (center: LatLng, radiusM: number): Promise<LatLng[]> => {
    const around = `${Math.round(radiusM)},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
    const query = `[out:json][timeout:20];
(
  way["highway"~"^(path|track|footway|bridleway)$"](around:${around});
  way["highway"="cycleway"]["foot"!="no"](around:${around});
);
out geom 4000;`;

    for (const url of OVERPASS_URLS) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: 'data=' + encodeURIComponent(query),
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                signal: AbortSignal.timeout(12000),
            });
            if (!response.ok) {
                continue;
            }
            const data = await response.json();
            const points: LatLng[] = [];
            for (const element of data.elements ?? []) {
                for (const g of element.geometry ?? []) {
                    points.push({lat: g.lat, lng: g.lon});
                }
            }
            return points;
        } catch {
            // the next mirror
        }
    }

    return [];
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
