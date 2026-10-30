import type {LayerSpecification, StyleSpecification} from "maplibre-gl";
import {mixHexColors} from "../../../../utilites/themeUtils.ts";

// Le style sobre d'OpenFreeMap (tuiles OpenStreetMap, sans cle), repeint aux couleurs de la page.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

const CREME = '#fff7e9';
const CARTE = '#fffcf8';
const BRUN = '#352924';

// Les numeros de route et les aeroports: du bruit sur une carte de quartier.
const HIDDEN_LAYERS = /shield|airport/;

const paletteFor = (accent: string) => ({
    fond: mixHexColors(accent, CREME, 0.06),
    eau: mixHexColors(accent, CREME, 0.32),
    vert: mixHexColors(accent, CREME, 0.16),
    quartier: mixHexColors(BRUN, CREME, 0.03),
    batiment: mixHexColors(BRUN, CREME, 0.08),
    batimentContour: mixHexColors(BRUN, CREME, 0.13),
    bordureRoute: mixHexColors(accent, CREME, 0.5),
    rail: mixHexColors(BRUN, CREME, 0.25),
    frontiere: mixHexColors(BRUN, CREME, 0.3),
    texte: mixHexColors(BRUN, CREME, 0.8),
    texteEau: mixHexColors(accent, BRUN, 0.45),
});

const repaint = (layer: LayerSpecification, palette: ReturnType<typeof paletteFor>): LayerSpecification => {
    const sourceLayer = 'source-layer' in layer ? layer['source-layer'] : undefined;
    const paint: Record<string, unknown> = {...(layer.paint ?? {})};

    if (layer.type === 'background') {
        paint['background-color'] = palette.fond;
    } else if (layer.type === 'symbol') {
        paint['text-color'] = sourceLayer?.startsWith('water') ? palette.texteEau : palette.texte;
        paint['text-halo-color'] = CREME;
    } else if (sourceLayer === 'water' || sourceLayer === 'waterway') {
        paint[layer.type === 'line' ? 'line-color' : 'fill-color'] = palette.eau;
    } else if (sourceLayer === 'park' || sourceLayer === 'landcover') {
        paint['fill-color'] = palette.vert;
    } else if (sourceLayer === 'landuse' || sourceLayer === 'aeroway') {
        paint[layer.type === 'line' ? 'line-color' : 'fill-color'] = palette.quartier;
    } else if (sourceLayer === 'building') {
        paint['fill-color'] = palette.batiment;
        paint['fill-outline-color'] = palette.batimentContour;
    } else if (sourceLayer === 'boundary') {
        paint['line-color'] = palette.frontiere;
    } else if (sourceLayer === 'transportation' && layer.type === 'line') {
        paint['line-color'] = layer.id.includes('casing')
            ? palette.bordureRoute
            : layer.id.includes('rail') ? palette.rail : CARTE;
    } else if (sourceLayer === 'transportation') {
        paint['fill-color'] = CARTE;
    }

    return {...layer, paint} as LayerSpecification;
};

/**
 * Le style de la carte « Emplacement »: le creme de la page, l'eau et les parcs teintes de la
 * couleur de l'organisateur, les routes en blanc bordees de la meme couleur.
 */
export const fetchMapStyle = async (accent: string): Promise<StyleSpecification> => {
    const response = await fetch(STYLE_URL);
    if (!response.ok) {
        // eslint-disable-next-line lingui/no-unlocalized-strings
        throw new Error(`OpenFreeMap style: ${response.status}`);
    }

    const style = await response.json() as StyleSpecification;
    const palette = paletteFor(accent);

    return {
        ...style,
        sources: {openmaptiles: style.sources.openmaptiles},
        layers: style.layers
            .filter((layer) => !HIDDEN_LAYERS.test(layer.id) && (!('source' in layer) || layer.source === 'openmaptiles'))
            .map((layer) => repaint(layer, palette)),
    };
};
