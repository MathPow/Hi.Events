/* eslint-disable lingui/no-unlocalized-strings -- technical strings: URLs, XML, map style keys */
import {t} from "@lingui/macro";
import type {ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, MapOptions} from "maplibre-gl";
import {cumulative, LatLng, pointAlong} from "../../../utilites/course/geo.ts";
import {fetchCourseMapStyle} from "./courseMapStyle.ts";

// The lines of the course maps, shared by the organizer's maker and the event page: the proposals,
// the course itself (white edge, arrows for its direction) and a mark at every kilometre.

// Not the page's brown ink: a proposal must not read as text or as the start flag.
export const PROPOSAL_COLORS = ['#2f7d6d', '#5157c4', '#c2532b', '#b83a72'];

/** « A », « B », « C »: the same letter on the list and on the map. */
export const proposalLetter = (index: number) => String.fromCharCode(65 + (index % 26));

const PROPOSALS = 'dehors-proposals';
const LABELS = 'dehors-proposal-labels';
const COURSE = 'dehors-course';
const KM = 'dehors-km';
const FONT = ['Noto Sans Bold'];
const HOVER: ExpressionSpecification = ['boolean', ['feature-state', 'hover'], false];

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>;

const lineFeature = (points: LatLng[], properties: Record<string, unknown> = {}): Feature => ({
    type: 'Feature',
    properties,
    geometry: {type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat])},
});

const collection = (features: Feature[]): GeoJSON.FeatureCollection => ({type: 'FeatureCollection', features});

export const loadCourseMap = async (container: HTMLElement, options: Partial<MapOptions> = {}) => {
    const [{default: maplibregl}, style] = await Promise.all([
        import('maplibre-gl'),
        fetchCourseMapStyle(),
        import('maplibre-gl/dist/maplibre-gl.css'),
    ]);

    const map = new maplibregl.Map({
        container,
        style,
        center: [-73.5673, 45.5017],
        zoom: 10,
        attributionControl: false,
        locale: {
            'CooperativeGesturesHandler.WindowsHelpText': t`Use Ctrl + scroll to zoom the map`,
            'CooperativeGesturesHandler.MacHelpText': t`Use ⌘ + scroll to zoom the map`,
            'CooperativeGesturesHandler.MobileHelpText': t`Use two fingers to move the map`,
            'NavigationControl.ZoomIn': t`Zoom in`,
            'NavigationControl.ZoomOut': t`Zoom out`,
            'AttributionControl.ToggleAttribution': t`Map credits`,
        },
        ...options,
    });
    map.addControl(new maplibregl.AttributionControl({compact: true}), 'bottom-right');

    await new Promise<void>((resolve, reject) => {
        map.once('load', () => resolve());
        map.once('error', (event) => reject(event.error));
    });

    // The credits open by themselves over the map on arrival: closed, behind their (i) button.
    const closeCredits = () => map.getContainer().querySelectorAll('.maplibregl-compact-show')
        .forEach((element) => element.classList.remove('maplibregl-compact-show'));
    closeCredits();
    map.once('idle', closeCredits);

    addCourseLayers(map);

    return {map, maplibregl};
};

const addCourseLayers = (map: MapLibreMap) => {
    map.addSource(PROPOSALS, {type: 'geojson', data: collection([])});
    map.addSource(LABELS, {type: 'geojson', data: collection([])});
    map.addSource(COURSE, {type: 'geojson', data: collection([])});
    map.addSource(KM, {type: 'geojson', data: collection([])});

    map.addLayer({
        id: `${PROPOSALS}-edge`,
        type: 'line',
        source: PROPOSALS,
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {
            'line-color': '#ffffff',
            'line-width': ['case', HOVER, 11, 8],
            'line-opacity': ['case', HOVER, 1, ['get', 'opacity']],
        },
    });
    map.addLayer({
        id: `${PROPOSALS}-line`,
        type: 'line',
        source: PROPOSALS,
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {
            'line-color': ['get', 'color'],
            'line-width': ['case', HOVER, 6.5, 4.5],
            'line-opacity': ['case', HOVER, 1, ['get', 'opacity']],
        },
    });

    map.addLayer({
        id: `${COURSE}-edge`,
        type: 'line',
        source: COURSE,
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {'line-color': '#ffffff', 'line-width': 11},
    });
    map.addLayer({
        id: `${COURSE}-line`,
        type: 'line',
        source: COURSE,
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {'line-color': ['get', 'color'], 'line-width': 6},
    });
    map.addLayer({
        id: `${COURSE}-arrows`,
        type: 'symbol',
        source: COURSE,
        layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 90,
            'text-field': '›',
            'text-font': FONT,
            'text-size': 20,
            'text-keep-upright': false,
            'text-allow-overlap': true,
            'text-offset': [0, -0.1],
        },
        paint: {'text-color': '#ffffff'},
    });

    // The kilometre marks: small and filled, so they don't look like the hollow points to drag.
    map.addLayer({
        id: `${KM}-dot`,
        type: 'circle',
        source: KM,
        paint: {
            'circle-radius': 8,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 1.5,
        },
    });
    map.addLayer({
        id: `${KM}-label`,
        type: 'symbol',
        source: KM,
        layout: {'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 9.5, 'text-allow-overlap': true},
        paint: {'text-color': '#ffffff'},
    });

    // Each proposal's letter, on a stretch of it that the others don't share.
    map.addLayer({
        id: `${LABELS}-dot`,
        type: 'circle',
        source: LABELS,
        paint: {
            'circle-radius': ['case', HOVER, 14, 12],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2.5,
        },
    });
    map.addLayer({
        id: `${LABELS}-letter`,
        type: 'symbol',
        source: LABELS,
        layout: {'text-field': ['get', 'letter'], 'text-font': FONT, 'text-size': 13, 'text-allow-overlap': true},
        paint: {'text-color': '#ffffff'},
    });
};

// Where to put a proposal's letter: the point of its line furthest from all the other proposals.
const labelPoint = (lines: LatLng[][], index: number): LatLng | null => {
    const points = lines[index];
    if (points.length < 2) {
        return null;
    }
    const cum = cumulative(points);
    const total = cum[cum.length - 1];
    const others = lines.flatMap((line, i) => {
        if (i === index || line.length < 2) {
            return [];
        }
        const step = Math.max(1, Math.floor(line.length / 120));
        return line.filter((_, j) => j % step === 0);
    });
    if (others.length === 0) {
        return pointAlong(points, cum, total * 0.4);
    }
    const kx = Math.cos((points[0].lat * Math.PI) / 180);
    let best: LatLng | null = null;
    let bestScore = -1;
    for (let i = 1; i < 20; i++) {
        const p = pointAlong(points, cum, (total * i) / 20);
        let nearest = Infinity;
        for (const o of others) {
            const dx = (o.lng - p.lng) * kx;
            const dy = o.lat - p.lat;
            nearest = Math.min(nearest, dx * dx + dy * dy);
        }
        // Away from the start too, where every proposal begins.
        const score = nearest * (i > 2 && i < 18 ? 1 : 0.5);
        if (score > bestScore) {
            bestScore = score;
            best = p;
        }
    }
    return best;
};

const setData = (map: MapLibreMap, source: string, data: GeoJSON.FeatureCollection) => {
    (map.getSource(source) as GeoJSONSource | undefined)?.setData(data);
};

/** The proposals with their letters, the chosen one bright and the others faded behind it. */
export const showProposals = (map: MapLibreMap, lines: LatLng[][], selected: number | null) => {
    const colorAt = (index: number) => PROPOSAL_COLORS[index % PROPOSAL_COLORS.length];
    setData(map, PROPOSALS, collection(lines.map((points, index) => ({
        ...lineFeature(points, {index, color: colorAt(index), opacity: selected === null ? 0.9 : 0.3}),
        id: index,
    })).filter((_, index) => index !== selected)));

    const labels: Feature[] = [];
    lines.forEach((_, index) => {
        const point = index === selected ? null : labelPoint(lines, index);
        if (point) {
            labels.push({
                type: 'Feature',
                id: index,
                properties: {index, color: colorAt(index), letter: proposalLetter(index)},
                geometry: {type: 'Point', coordinates: [point.lng, point.lat]},
            });
        }
    });
    setData(map, LABELS, collection(labels));
};

/** A proposal pointed at, in the list or on the map: its line and its letter stand out. */
export const hoverProposal = (map: MapLibreMap, index: number | null, previous: number | null) => {
    for (const source of [PROPOSALS, LABELS]) {
        if (!map.getSource(source)) {
            continue;
        }
        if (previous !== null) {
            map.setFeatureState({source, id: previous}, {hover: false});
        }
        if (index !== null) {
            map.setFeatureState({source, id: index}, {hover: true});
        }
    }
};

/** The course, with a mark at every kilometre (every 5 past 30 km, every 10 past 100). */
export const showCourse = (map: MapLibreMap, points: LatLng[], color: string) => {
    setData(map, COURSE, collection(points.length > 1 ? [lineFeature(points, {color})] : []));

    const cum = cumulative(points);
    const total = cum[cum.length - 1] ?? 0;
    const step = total > 100000 ? 10000 : total > 30000 ? 5000 : 1000;
    const marks: Feature[] = [];
    for (let d = step; d < total - step * 0.3; d += step) {
        const p = pointAlong(points, cum, d);
        marks.push({type: 'Feature', properties: {label: String(d / 1000), color}, geometry: {type: 'Point', coordinates: [p.lng, p.lat]}});
    }
    setData(map, KM, collection(marks));
};

export const PROPOSALS_LAYER = `${PROPOSALS}-line`;
export const PROPOSAL_LABELS_LAYER = `${LABELS}-dot`;
export const COURSE_LAYER = `${COURSE}-line`;
