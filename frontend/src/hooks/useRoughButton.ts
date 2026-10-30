import {useCallback, useRef} from "react";
import {ROUGH_INTENSITY} from "../utilites/roughEdge.ts";

/**
 * The hand-cut outline of the DEHORS shop buttons (dehors-shop-new, rugueux.ts).
 * A pill is walked along its perimeter and each point is pushed in or out by a
 * smooth looping noise measured in pixels, so a longer button gets more bumps,
 * not stretched ones. The ends stay smooth; only the long sides are rough.
 *
 * Nothing is painted here: three outlines are drawn per button and set as mask
 * images (`--rough-shape`, `--rough-shape-2`, `--rough-shape-3`), which the
 * landing styles apply to `::before` and cycle through on hover.
 */
// The pill's corner radius, as a fraction of its height: a short button (one word) is a
// true pill with round ends; between SHORT and LONG times its height wide, the radius
// goes from one to the other (rugueux.ts).
const RADIUS = 0.4;
const RADIUS_SHORT = 0.5;
const SHORT = 3;
const LONG = 6;
const LAYERS = [
    {step: 44, amplitude: 1.2},
    {step: 14, amplitude: 0.15},
];
// A round button is rough all the way around, in small bumps: a few big ones
// would turn the circle into a polygon.
const ROUND_LAYERS = [
    {step: 16, amplitude: 1},
    {step: 7, amplitude: 0.25},
];
const END_FADE = 1.5;
const OUTLINES = 3;
const SAMPLE = 6;
const MARGIN = Math.ceil(Math.max(...[LAYERS, ROUND_LAYERS].map((layers) =>
    layers.reduce((sum, layer) => sum + layer.amplitude, 0))) * 1.25 + 2);

type PointNormal = [x: number, y: number, nx: number, ny: number];

interface Segment {
    length: number;
    point: (s: number) => PointNormal;
}

const endFade = (x: number, width: number, height: number) => {
    const t = Math.min(1, Math.max(0, Math.min(x, width - x) / (height * END_FADE)));
    return t * t * (3 - 2 * t);
};

const random = (seed: number) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/** Signs alternate so the edge never goes flat for long next to a cluster of bumps. */
const loopingNoise = (length: number, step: number, draw: () => number) => {
    const count = Math.max(4, 2 * Math.round(length / step / 2));
    const values = Array.from({length: count}, (_, i) => (i % 2 ? 1 : -1) * (0.35 + 0.65 * draw()));
    const value = (i: number) => values[((i % count) + count) % count];

    return (s: number) => {
        const t = (s / length) * count;
        const i = Math.floor(t);
        const f = t - i;
        const [p0, p1, p2, p3] = [value(i - 1), value(i), value(i + 1), value(i + 2)];
        return 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f
            + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
    };
};

const line = (x: number, y: number, dx: number, dy: number, length: number): Segment =>
    ({length, point: (s) => [x + dx * s, y + dy * s, dy, -dx]});

const corner = (cx: number, cy: number, radius: number, start: number): Segment => ({
    length: (Math.PI / 2) * radius,
    point: (s) => {
        const angle = start + s / radius;
        const [nx, ny] = [Math.cos(angle), Math.sin(angle)];
        return [cx + radius * nx, cy + radius * ny, nx, ny];
    },
});

const pillRadius = (width: number, height: number) => {
    const t = Math.min(1, Math.max(0, (width / height - SHORT) / (LONG - SHORT)));
    return Math.min(height * (RADIUS_SHORT + (RADIUS - RADIUS_SHORT) * t), width / 2);
};

const pill = (width: number, height: number, radius = pillRadius(width, height)) => {
    const r = Math.min(radius, width / 2, height / 2);
    const segments = [
        line(r, 0, 1, 0, width - 2 * r),
        corner(width - r, r, r, -Math.PI / 2),
        line(width, r, 0, 1, height - 2 * r),
        corner(width - r, height - r, r, 0),
        line(width - r, height, -1, 0, width - 2 * r),
        corner(r, height - r, r, Math.PI / 2),
        line(0, height - r, 0, -1, height - 2 * r),
        corner(r, r, r, Math.PI),
    ];
    const perimeter = segments.reduce((sum, segment) => sum + segment.length, 0);
    const point = (s: number): PointNormal => {
        for (const segment of segments) {
            if (s <= segment.length) {
                return segment.point(s);
            }
            s -= segment.length;
        }
        return segments[0].point(0);
    };

    return {perimeter, point};
};

const circle = (size: number) => {
    const r = size / 2;
    const point = (s: number): PointNormal => {
        const angle = s / r - Math.PI / 2;
        const [nx, ny] = [Math.cos(angle), Math.sin(angle)];
        return [r + r * nx, r + r * ny, nx, ny];
    };

    return {perimeter: 2 * Math.PI * r, point};
};

/**
 * The rough outline, drawn MARGIN px into its mask. `inward` draws it in the box's own
 * pixels instead, on the box's own corner radius, pulled in by the largest bump so it
 * never leaves the box, with its bumps scaled by `scale`: a clip-path for a button that
 * paints its own fill.
 */
const roughPath = (width: number, height: number, seed: number, round: boolean,
                   inward?: { scale: number, radius: number }) => {
    const {perimeter, point} = round ? circle(Math.min(width, height)) : pill(width, height, inward?.radius);
    const layers = round ? ROUND_LAYERS : LAYERS;
    const noises = layers.map((layer, i) => ({
        amplitude: layer.amplitude * ROUGH_INTENSITY * (inward?.scale ?? 1),
        noise: loopingNoise(perimeter, layer.step, random(seed + i * 7919)),
    }));
    // The spline can overshoot its values by a quarter.
    const pull = inward ? 1.25 * noises.reduce((sum, {amplitude}) => sum + amplitude, 0) : 0;
    const shift = inward ? 0 : MARGIN;

    const count = Math.max(16, Math.round(perimeter / SAMPLE));
    const points: [number, number][] = [];
    for (let j = 0; j < count; j++) {
        const s = (j / count) * perimeter;
        const [x, y, nx, ny] = point(s);
        const offset = (round ? 1 : endFade(x, width, height))
            * noises.reduce((sum, {amplitude, noise}) => sum + amplitude * noise(s), 0) - pull;
        points.push([shift + x + nx * offset, shift + y + ny * offset]);
    }

    const p = (i: number) => points[(i + count) % count];
    const n = (v: number) => v.toFixed(1);
    let path = `M${n(p(0)[0])} ${n(p(0)[1])}`;
    for (let i = 0; i < count; i++) {
        const [a, b, c, d] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
        path += `C${n(b[0] + (c[0] - a[0]) / 6)} ${n(b[1] + (c[1] - a[1]) / 6)}`
            + ` ${n(c[0] - (d[0] - b[0]) / 6)} ${n(c[1] - (d[1] - b[1]) / 6)} ${n(c[0])} ${n(c[1])}`;
    }
    return `${path}Z`;
};

/** The largest bump of a rough button, before scaling, in px. */
export const ROUGH_BUTTON_BUMP = 1.25 * ROUGH_INTENSITY * LAYERS.reduce((sum, layer) => sum + layer.amplitude, 0);

/** The rough outline of a button with corners of `radius`, inside its own box. */
export const roughButtonPath = (width: number, height: number, seed: number,
                                {radius, round = false, scale = 1}: { radius: number, round?: boolean, scale?: number }) =>
    roughPath(width, height, seed, round, {scale, radius});

const asMask = (width: string, height: string, path: string) =>
    `url("data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${path}"/></svg>`)}")`;

/**
 * Callback ref that draws the rough outlines for the element and redraws them
 * when it resizes; `round` cuts a circle instead of a pill.
 */
export const useRoughButton = <T extends HTMLElement>({round = false}: { round?: boolean } = {}) => {
    const observer = useRef<ResizeObserver | null>(null);
    const seed = useRef(Math.floor(Math.random() * 2 ** 32));

    return useCallback((element: T | null) => {
        observer.current?.disconnect();
        observer.current = null;
        if (!element || typeof ResizeObserver === 'undefined') {
            return;
        }

        let [drawnWidth, drawnHeight] = [0, 0];
        element.style.setProperty('--rough-margin', `${MARGIN}px`);
        observer.current = new ResizeObserver((entries) => {
            const box = entries[0]?.borderBoxSize?.[0];
            const width = box?.inlineSize ?? element.offsetWidth;
            const height = box?.blockSize ?? element.offsetHeight;
            if (width <= 0 || height <= 0
                || (Math.abs(width - drawnWidth) < 0.5 && Math.abs(height - drawnHeight) < 0.5)) {
                return;
            }
            [drawnWidth, drawnHeight] = [width, height];

            const [w, h] = [(width + 2 * MARGIN).toFixed(1), (height + 2 * MARGIN).toFixed(1)];
            for (let i = 0; i < OUTLINES; i++) {
                element.style.setProperty(`--rough-shape${i ? `-${i + 1}` : ''}`,
                    asMask(w, h, roughPath(width, height, seed.current + i * 104729, round)));
            }
        });
        observer.current.observe(element);
    }, [round]);
};
