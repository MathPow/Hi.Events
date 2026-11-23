/* eslint-disable lingui/no-unlocalized-strings -- technical strings: URLs, XML, map style keys */
import type {ExpressionSpecification, LayerSpecification, StyleSpecification} from "maplibre-gl";

// The course map: OpenFreeMap's sober style (OpenStreetMap tiles, no key) on Dehors's cream, with
// everything a course can follow drawn in Dehors orange: trails in full orange, dirt tracks dashed,
// streets white with an orange edge. Water stays blue and woods green, to find one's way.

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export const DEHORS_ORANGE = '#fa7853';
const ORANGE_EDGE = '#f7b59c';
const CREME = '#fbf4e8';
const BRUN = '#352924';

const HIDDEN_LAYERS = /shield|airport/;

const widthByZoom = (low: number, high: number): ExpressionSpecification => ['interpolate', ['exponential', 1.4], ['zoom'], 12, low, 17, high];

const repaint = (layer: LayerSpecification): LayerSpecification => {
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;
    const paint: Record<string, unknown> = {...(layer.paint ?? {})};

    if (layer.type === 'background') {
        paint['background-color'] = CREME;
    } else if (layer.type === 'symbol') {
        paint['text-color'] = sourceLayer?.startsWith('water') ? '#4f7a8c' : 'rgba(53, 41, 36, 0.78)';
        paint['text-halo-color'] = CREME;
    } else if (sourceLayer === 'water' || sourceLayer === 'waterway') {
        paint[layer.type === 'line' ? 'line-color' : 'fill-color'] = '#cfe2ea';
    } else if (sourceLayer === 'park' || sourceLayer === 'landcover') {
        paint['fill-color'] = '#e2ebd1';
    } else if (sourceLayer === 'landuse' || sourceLayer === 'aeroway') {
        paint[layer.type === 'line' ? 'line-color' : 'fill-color'] = '#f3ead9';
    } else if (sourceLayer === 'building') {
        paint['fill-color'] = '#efe4d4';
        paint['fill-outline-color'] = '#e5d6c2';
    } else if (sourceLayer === 'boundary') {
        paint['line-color'] = 'rgba(53, 41, 36, 0.25)';
    } else if (sourceLayer === 'transportation' && layer.type === 'line') {
        if (layer.id.includes('rail')) {
            paint['line-color'] = 'rgba(53, 41, 36, 0.25)';
        } else if (layer.id === 'highway_path') {
            paint['line-color'] = DEHORS_ORANGE;
            paint['line-width'] = widthByZoom(1.2, 3.2);
            delete paint['line-dasharray'];
        } else {
            paint['line-color'] = layer.id.includes('casing') ? ORANGE_EDGE : '#ffffff';
        }
    } else if (sourceLayer === 'transportation') {
        paint['fill-color'] = '#ffffff';
    }

    return {...layer, paint} as LayerSpecification;
};

// Forest roads and dirt tracks, over the streets they are drawn with in the base style.
const trackLayer: LayerSpecification = {
    id: 'dehors-tracks',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    minzoom: 12,
    filter: ['==', ['get', 'class'], 'track'],
    layout: {'line-cap': 'round', 'line-join': 'round'},
    paint: {
        'line-color': DEHORS_ORANGE,
        'line-width': widthByZoom(1, 2.6),
        'line-dasharray': [2, 1.5],
    },
};

export const fetchCourseMapStyle = async (): Promise<StyleSpecification> => {
    const response = await fetch(STYLE_URL);
    if (!response.ok) {
        // eslint-disable-next-line lingui/no-unlocalized-strings
        throw new Error(`OpenFreeMap style: ${response.status}`);
    }

    const style = await response.json() as StyleSpecification;
    const layers = style.layers
        .filter((layer) => !HIDDEN_LAYERS.test(layer.id) && (!('source' in layer) || layer.source === 'openmaptiles'))
        .map(repaint);
    const afterMinor = layers.findIndex((layer) => layer.id === 'highway_minor') + 1;
    layers.splice(afterMinor > 0 ? afterMinor : layers.length, 0, trackLayer);

    return {...style, sources: {openmaptiles: style.sources.openmaptiles}, layers};
};

export const COURSE_INK = BRUN;
