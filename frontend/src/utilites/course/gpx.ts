/* eslint-disable lingui/no-unlocalized-strings -- technical strings: URLs, XML, map style keys */
import {LatLng, TrackPoint} from "./geo.ts";
import {CourseSurface} from "./routing.ts";

// GPX in and out. A course drawn in Dehors keeps its control points in the file's metadata (a GPX
// extension that watches and apps ignore), so the organizer can open it again and keep editing.

export type CourseKind = 'loop' | 'line';

export interface CourseDesign {
    kind: CourseKind;
    surface: CourseSurface;
    targetM?: number;
    waypoints: LatLng[];
}

export interface ParsedGpx {
    name?: string;
    points: TrackPoint[];
    design?: CourseDesign;
}

const DEHORS_NS = 'https://billets.dehorsqc.com/xmlns/parcours/1';

const escapeXml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const readPoint = (element: Element): TrackPoint | null => {
    const lat = parseFloat(element.getAttribute('lat') ?? '');
    const lng = parseFloat(element.getAttribute('lon') ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    const ele = parseFloat(element.getElementsByTagName('ele')[0]?.textContent ?? '');

    return Number.isFinite(ele) ? {lat, lng, ele} : {lat, lng};
};

export const parseGpx = (xml: string): ParsedGpx | null => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0 || doc.documentElement.localName !== 'gpx') {
        return null;
    }

    const trackPoints = [...doc.getElementsByTagName('trkpt')];
    const source = trackPoints.length > 0 ? trackPoints : [...doc.getElementsByTagName('rtept')];
    const points = source.map(readPoint).filter((p): p is TrackPoint => p !== null);

    const course = doc.getElementsByTagNameNS(DEHORS_NS, 'course')[0];
    let design: CourseDesign | undefined;
    if (course) {
        const waypoints = [...course.getElementsByTagNameNS(DEHORS_NS, 'point')]
            .map(readPoint)
            .filter((p): p is TrackPoint => p !== null)
            .map(({lat, lng}) => ({lat, lng}));
        const kind = course.getAttribute('kind') === 'line' ? 'line' : 'loop';
        const surface = course.getAttribute('surface');
        const target = parseFloat(course.getAttribute('target') ?? '');
        if (waypoints.length >= 2) {
            design = {
                kind,
                surface: surface === 'mixed' || surface === 'road' ? surface : 'trail',
                targetM: Number.isFinite(target) && target > 0 ? target : undefined,
                waypoints,
            };
        }
    }

    const name = (doc.getElementsByTagName('trk')[0]?.getElementsByTagName('name')[0]
        ?? doc.getElementsByTagName('metadata')[0]?.getElementsByTagName('name')[0])?.textContent?.trim();

    return {name: name || undefined, points, design};
};

export const buildGpx = (name: string, points: TrackPoint[], design?: CourseDesign): string => {
    const safeName = escapeXml(name);
    const trackPoints = points.map((p) => (
        p.ele === undefined
            ? `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"/>`
            : `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`
    )).join('\n');

    const extension = design ? `
    <extensions>
      <dehors:course kind="${design.kind}" surface="${design.surface}"${design.targetM ? ` target="${Math.round(design.targetM)}"` : ''}>
${design.waypoints.map((p) => `        <dehors:point lat="${p.lat.toFixed(6)}" lon="${p.lng.toFixed(6)}"/>`).join('\n')}
      </dehors:course>
    </extensions>` : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Billetterie Dehors" xmlns="http://www.topografix.com/GPX/1/1" xmlns:dehors="${DEHORS_NS}">
  <metadata>
    <name>${safeName}</name>${extension}
  </metadata>
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>
`;
};

/** « Boucle 5 km.gpx », without the characters a file system refuses. */
export const gpxFileName = (name: string): string => {
    const clean = Array.from(name, (char) => (char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? ' ' : char))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();

    return `${clean || 'parcours'}.gpx`;
};

export const downloadGpx = (name: string, xml: string) => {
    const url = URL.createObjectURL(new Blob([xml], {type: 'application/gpx+xml'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = gpxFileName(name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
