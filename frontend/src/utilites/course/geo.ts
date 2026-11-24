// Geo maths for the course maker, ported from UltraTalesTrack (itself from OffTrail).
// Distances in metres, points as {lat, lng}.

export interface LatLng {
    lat: number;
    lng: number;
}

export interface TrackPoint extends LatLng {
    ele?: number;
}

const EARTH_RADIUS_M = 6371000;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;
const toDeg = (radians: number) => (radians * 180) / Math.PI;

export const haversine = (a: LatLng, b: LatLng): number => {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

export const pathDistance = (points: LatLng[]): number => {
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        total += haversine(points[i - 1], points[i]);
    }

    return total;
};

/** Climb in metres, ignoring the noise of a few centimetres between two points. */
export const elevationGain = (points: TrackPoint[]): number => {
    let gain = 0;
    let base: number | undefined;
    for (const point of points) {
        if (point.ele === undefined) {
            continue;
        }
        if (base === undefined || point.ele < base) {
            base = point.ele;
        } else if (point.ele - base >= 3) {
            gain += point.ele - base;
            base = point.ele;
        }
    }

    return Math.round(gain);
};

/** The point `distanceM` away from `from`, heading `bearingDeg` (0 = north, clockwise). */
export const destination = (from: LatLng, bearingDeg: number, distanceM: number): LatLng => {
    const angular = distanceM / EARTH_RADIUS_M;
    const bearing = toRad(bearingDeg);
    const lat1 = toRad(from.lat);
    const lng1 = toRad(from.lng);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

    return {lat: toDeg(lat2), lng: ((toDeg(lng2) + 540) % 360) - 180};
};

export const bearing = (a: LatLng, b: LatLng): number => {
    const dLng = toRad(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
    const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const distanceToSegment = (p: LatLng, a: LatLng, b: LatLng): { dist: number; t: number } => {
    const kx = Math.cos(toRad((a.lat + b.lat) / 2)) * 111320;
    const ky = 110540;
    const vx = (b.lng - a.lng) * kx;
    const vy = (b.lat - a.lat) * ky;
    const wx = (p.lng - a.lng) * kx;
    const wy = (p.lat - a.lat) * ky;
    const length2 = vx * vx + vy * vy;
    const t = length2 > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / length2)) : 0;

    return {
        dist: haversine(p, {lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng)}),
        t,
    };
};

/** Ramer-Douglas-Peucker: keeps the points that carry the shape of a line. */
export const simplify = (points: LatLng[], toleranceM: number): LatLng[] => {
    if (points.length <= 2) {
        return points.slice();
    }

    const first = points[0];
    const last = points[points.length - 1];
    let maxDistance = 0;
    let index = 0;
    for (let i = 1; i < points.length - 1; i++) {
        const {dist} = distanceToSegment(points[i], first, last);
        if (dist > maxDistance) {
            maxDistance = dist;
            index = i;
        }
    }

    if (maxDistance <= toleranceM) {
        return [first, last];
    }

    const left = simplify(points.slice(0, index + 1), toleranceM);
    const right = simplify(points.slice(index), toleranceM);

    return [...left.slice(0, -1), ...right];
};

/** Distance along the line (metres) of the point of the line nearest to `p`, searching from `fromIndex`. */
export const nearestAlong = (p: LatLng, line: LatLng[], fromIndex = 0): { index: number; along: number; dist: number; point: LatLng } => {
    let best = {index: fromIndex, along: 0, dist: Infinity, point: line[fromIndex] ?? p};
    let before = 0;
    for (let i = 1; i < line.length; i++) {
        const segment = haversine(line[i - 1], line[i]);
        if (i - 1 >= fromIndex) {
            const {dist, t} = distanceToSegment(p, line[i - 1], line[i]);
            if (dist < best.dist) {
                best = {
                    index: i - 1,
                    along: before + t * segment,
                    dist,
                    point: {lat: line[i - 1].lat + t * (line[i].lat - line[i - 1].lat), lng: line[i - 1].lng + t * (line[i].lng - line[i - 1].lng)},
                };
            }
        }
        before += segment;
    }

    return best;
};

/** Cumulative distance at each point of a line (cum[0] = 0). */
export const cumulative = (line: LatLng[]): number[] => {
    const cum = [0];
    for (let i = 1; i < line.length; i++) {
        cum.push(cum[i - 1] + haversine(line[i - 1], line[i]));
    }

    return cum;
};

/** The point at `distanceM` along the line. */
export const pointAlong = (line: LatLng[], cum: number[], distanceM: number): LatLng => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < distanceM) {
        i++;
    }
    const a = line[i - 1];
    const b = line[i] ?? a;
    const span = cum[i] - cum[i - 1] || 1;
    const t = Math.max(0, Math.min(1, (distanceM - cum[i - 1]) / span));

    return {lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng)};
};

/**
 * The share of a course run twice (out-and-back spurs): a sample every 25 m that has another sample,
 * at least 150 m further along, within 15 m of it. 0 = never the same way twice.
 */
export const backtrackShare = (line: LatLng[]): number => {
    const cum = cumulative(line);
    const total = cum[cum.length - 1];
    if (total < 200) {
        return 0;
    }

    const step = 25;
    const samples: { point: LatLng; along: number }[] = [];
    for (let d = 0; d <= total; d += step) {
        samples.push({point: pointAlong(line, cum, d), along: d});
    }

    let repeated = 0;
    for (let i = 0; i < samples.length; i++) {
        for (let j = i + 1; j < samples.length; j++) {
            if (samples[j].along - samples[i].along < 150) {
                continue;
            }
            // Skip the end of a loop meeting its own start.
            if (samples[i].along < 150 && total - samples[j].along < 150) {
                continue;
            }
            if (haversine(samples[i].point, samples[j].point) < 15) {
                repeated++;
                break;
            }
        }
    }

    return Math.min(1, (2 * repeated) / samples.length);
};

/** Share of `a` that runs within 25 m of `b`: two proposals that overlap this much are the same course. */
export const overlapShare = (a: LatLng[], b: LatLng[]): number => {
    const cum = cumulative(a);
    const total = cum[cum.length - 1];
    if (total === 0 || b.length < 2) {
        return 0;
    }

    let near = 0;
    let count = 0;
    for (let d = 0; d <= total; d += 50) {
        count++;
        if (nearestAlong(pointAlong(a, cum, d), b).dist < 25) {
            near++;
        }
    }

    return near / count;
};

export const boundsOf = (points: LatLng[]): [[number, number], [number, number]] | null => {
    if (points.length === 0) {
        return null;
    }

    let minLng = points[0].lng, maxLng = points[0].lng, minLat = points[0].lat, maxLat = points[0].lat;
    for (const p of points) {
        minLng = Math.min(minLng, p.lng);
        maxLng = Math.max(maxLng, p.lng);
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
    }

    return [[minLng, minLat], [maxLng, maxLat]];
};

// A point every `step` metres along the line, with its distance along it.
const resample = (line: LatLng[], step: number): { point: LatLng; along: number }[] => {
    const cum = cumulative(line);
    const total = cum[cum.length - 1] ?? 0;
    const samples: { point: LatLng; along: number }[] = [];
    let i = 1;
    for (let d = 0; d <= total; d += step) {
        while (i < cum.length - 1 && cum[i] < d) {
            i++;
        }
        const a = line[i - 1];
        const b = line[i] ?? a;
        const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)));
        samples.push({point: {lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng)}, along: d});
    }

    return samples;
};

/**
 * The out-and-back stubs of a line (a dead end run to its end and back): where each one leaves the
 * line and where it comes back, in metres along it. Those shorter than `minM` don't count.
 */
export const findSpurs = (line: LatLng[], minM = 40): { from: number; to: number }[] => {
    const step = 10;
    const samples = resample(line, step);
    const spurs: { from: number; to: number }[] = [];
    for (let tip = 1; tip < samples.length - 1; tip++) {
        let k = 0;
        while (tip - k - 1 >= 0 && tip + k + 1 < samples.length
        && haversine(samples[tip - k - 1].point, samples[tip + k + 1].point) < 12) {
            k++;
        }
        if (k * step >= minM) {
            spurs.push({from: samples[tip - k].along, to: samples[tip + k].along});
            tip += k;
        }
    }

    return spurs;
};

const crosses = (a: LatLng, b: LatLng, c: LatLng, d: LatLng) => {
    const side = (p: LatLng, q: LatLng, r: LatLng) => Math.sign((q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng));

    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
};

/** How many times a line crosses itself (a loop meeting its start doesn't count). */
export const selfCrossings = (line: LatLng[]): number => {
    const s = simplify(line, 8);
    let count = 0;
    for (let i = 0; i < s.length - 1; i++) {
        for (let j = i + 2; j < s.length - 1; j++) {
            if (!(i === 0 && j === s.length - 2) && crosses(s[i], s[i + 1], s[j], s[j + 1])) {
                count++;
            }
        }
    }

    return count;
};
