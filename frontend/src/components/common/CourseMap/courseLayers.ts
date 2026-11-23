/* eslint-disable lingui/no-unlocalized-strings -- technical strings: URLs, XML, map style keys */
import type {GeoJSONSource, Map as MapLibreMap, MapOptions} from "maplibre-gl";
import {cumulative, LatLng, pointAlong} from "../../../utilites/course/geo.ts";
import {fetchCourseMapStyle} from "./courseMapStyle.ts";

// The lines of the course maps, shared by the organizer's maker and the event page: the proposals,
// the course itself (white edge, arrows for its direction) and a mark at every kilometre.

export const PROPOSAL_COLORS = ['#352924', '#2f7d6d', '#5157c4', '#b83a72'];

const PROPOSALS = 'dehors-proposals';
const COURSE = 'dehors-course';
const KM = 'dehors-km';
const FONT = ['Noto Sans Bold'];

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
        ...options,
    });
    map.addControl(new maplibregl.AttributionControl({compact: true}), 'bottom-right');

    await new Promise<void>((resolve, reject) => {
        map.once('load', () => resolve());
        map.once('error', (event) => reject(event.error));
    });

    addCourseLayers(map);

    return {map, maplibregl};
};

const addCourseLayers = (map: MapLibreMap) => {
    map.addSource(PROPOSALS, {type: 'geojson', data: collection([])});
    map.addSource(COURSE, {type: 'geojson', data: collection([])});
    map.addSource(KM, {type: 'geojson', data: collection([])});

    map.addLayer({
        id: `${PROPOSALS}-edge`,
        type: 'line',
        source: PROPOSALS,
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {'line-color': '#ffffff', 'line-width': 8, 'line-opacity': ['get', 'opacity']},
    });
    map.addLayer({
        id: `${PROPOSALS}-line`,
        type: 'line',
        source: PROPOSALS,
        layout: {'line-cap': 'round', 'line-join': 'round'},
        paint: {'line-color': ['get', 'color'], 'line-width': 4.5, 'line-opacity': ['get', 'opacity']},
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

    map.addLayer({
        id: `${KM}-dot`,
        type: 'circle',
        source: KM,
        paint: {
            'circle-radius': 9,
            'circle-color': '#ffffff',
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': 2,
        },
    });
    map.addLayer({
        id: `${KM}-label`,
        type: 'symbol',
        source: KM,
        layout: {'text-field': ['get', 'label'], 'text-font': FONT, 'text-size': 10, 'text-allow-overlap': true},
        paint: {'text-color': '#352924'},
    });
};

const setData = (map: MapLibreMap, source: string, data: GeoJSON.FeatureCollection) => {
    (map.getSource(source) as GeoJSONSource | undefined)?.setData(data);
};

/** The proposals, the chosen one bright and the others faded behind it. */
export const showProposals = (map: MapLibreMap, lines: LatLng[][], selected: number | null) => {
    setData(map, PROPOSALS, collection(lines.map((points, index) => lineFeature(points, {
        index,
        color: PROPOSAL_COLORS[index % PROPOSAL_COLORS.length],
        opacity: selected === null ? 0.9 : 0.3,
    })).filter((_, index) => index !== selected)));
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
export const COURSE_LAYER = `${COURSE}-line`;
