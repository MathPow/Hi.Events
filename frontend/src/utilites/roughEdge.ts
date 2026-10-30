/**
 * Hand-cut edges for rounded boxes, ported from the DEHORS shop (bordDecoupe.ts).
 *
 * Every ~`step` px along each side, the edge steps inward by 0 to `amplitude` px,
 * joined by flat-tangent S curves. The path is drawn at the element's real size,
 * so a box twice as wide gets twice as many steps instead of stretched ones.
 * The edge only ever goes inward, so the shape stays inside the box.
 */

/**
 * How pronounced every hand-cut edge of the app is, blocks and buttons alike: 1 keeps the
 * shop's settings, lower makes the edges quieter. Applied where the paths are drawn, so the
 * amplitudes passed around stay the shop's.
 */
export const ROUGH_INTENSITY = 0.7;

export interface RoughEdgeOptions {
    radius: number;
    step: number;
    amplitude: number;
    seed: number;
}

const mulberry32 = (seed: number): () => number => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const KAPPA = 0.5523;
const f = (v: number) => v.toFixed(1);

export const roughEdgePath = (width: number, height: number, options: RoughEdgeOptions): string => {
    const {step} = options;
    const amplitude = options.amplitude * ROUGH_INTENSITY;
    const radius = Math.min(options.radius, width / 2, height / 2);
    const random = mulberry32(options.seed);
    let alternate = 1;
    const inset = () => {
        alternate = -alternate;
        return amplitude / 2 + (alternate * amplitude / 2) * (0.35 + 0.65 * random());
    };

    const sides = [
        {o: [radius, 0], d: [1, 0], n: [0, 1], length: width - 2 * radius},
        {o: [width, radius], d: [0, 1], n: [-1, 0], length: height - 2 * radius},
        {o: [width - radius, height], d: [-1, 0], n: [0, -1], length: width - 2 * radius},
        {o: [0, height - radius], d: [0, -1], n: [1, 0], length: height - 2 * radius},
    ];

    const corner = (a: number[], da: number[], b: number[], db: number[]) => {
        const [ex, ey] = [Math.abs(b[0] - a[0]) * KAPPA, Math.abs(b[1] - a[1]) * KAPPA];
        return `C${f(a[0] + da[0] * ex)} ${f(a[1] + da[1] * ey)} ${f(b[0] - db[0] * ex)} ${f(b[1] - db[1] * ey)} ${f(b[0])} ${f(b[1])}`;
    };

    let path = '';
    let first: number[] = [];
    let last: number[] = [];
    sides.forEach((side, k) => {
        // A side of no length (the ends of a pill, at half the height) is a single point: two points
        // in the same place, inset differently, made a step halfway up the end (bordDecoupe.ts).
        const steps = side.length < 1 ? 0 : Math.max(1, Math.round(side.length / step));
        const points = Array.from({length: steps + 1}, (_, j) => {
            const s = steps ? (j / steps) * side.length : 0;
            const r = inset();
            return [side.o[0] + side.d[0] * s + side.n[0] * r, side.o[1] + side.d[1] * s + side.n[1] * r];
        });
        if (k === 0) {
            first = points[0];
            path = `M${f(first[0])} ${f(first[1])}`;
        } else {
            path += corner(last, sides[k - 1].d, points[0], side.d);
        }
        for (let j = 1; j < points.length; j++) {
            const [a, b] = [points[j - 1], points[j]];
            const c1 = side.d[0] ? [(a[0] + b[0]) / 2, a[1]] : [a[0], (a[1] + b[1]) / 2];
            const c2 = side.d[0] ? [(a[0] + b[0]) / 2, b[1]] : [b[0], (a[1] + b[1]) / 2];
            path += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(b[0])} ${f(b[1])}`;
        }
        last = points[points.length - 1];
    });

    return `${path}${corner(last, sides[3].d, first, sides[0].d)}Z`;
};

const FRINGE = 1.5;

/**
 * An even-odd clip that only removes the thin band between the box's rounded
 * edge and the cut edge: everything outside the box (focus ring, shadows,
 * overflowing stickers) stays visible.
 */
export const roughEdgeClipPath = (width: number, height: number, options: RoughEdgeOptions, margin = 64): string =>
    roughClipPath(width, height, Math.min(options.radius, width / 2, height / 2), roughEdgePath(width, height, options), margin);

/**
 * The same even-odd clip around any shape drawn inside the box (a rough button):
 * the box, rounded by `radius`, is removed with its fringe, and the shape put back.
 */
export const roughClipPath = (width: number, height: number, radius: number, shape: string, margin = 64): string => {
    const r = radius + FRINGE;
    const [x0, y0, x1, y1] = [-FRINGE, -FRINGE, width + FRINGE, height + FRINGE];
    const arc = `A${f(r)} ${f(r)} 0 0 1`;
    const outside = `M${f(-margin)} ${f(-margin)}H${f(width + margin)}V${f(height + margin)}H${f(-margin)}Z `
        + `M${f(x0 + r)} ${f(y0)}H${f(x1 - r)}${arc} ${f(x1)} ${f(y0 + r)}V${f(y1 - r)}${arc} ${f(x1 - r)} ${f(y1)}`
        + `H${f(x0 + r)}${arc} ${f(x0)} ${f(y1 - r)}V${f(y0 + r)}${arc} ${f(x0 + r)} ${f(y0)}Z `;

    return `path(evenodd, "${outside}${shape}")`;
};
