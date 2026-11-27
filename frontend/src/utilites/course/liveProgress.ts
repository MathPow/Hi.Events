import {cumulative, LatLng} from "./geo.ts";

// Where a participant is on a course, from their last position: how far along, how far off it.

export interface LoadedLiveCourse {
    id: number;
    label: string;
    points: LatLng[];
    cum: number[];
    total: number;
}

export interface CoursePosition {
    courseId: number;
    // Metres along the course.
    along: number;
    // Metres between the participant and the course.
    off: number;
    // 0 to 1.
    share: number;
}

export const loadLiveCourse = (id: number, label: string, points: LatLng[]): LoadedLiveCourse => {
    const cum = cumulative(points);

    return {id, label, points, cum, total: cum[cum.length - 1] ?? 0};
};

// A flat projection around the point: plenty precise over a few hundred metres.
const segmentDistance = (p: LatLng, a: LatLng, b: LatLng): { dist: number; t: number } => {
    const kx = Math.cos((p.lat * Math.PI) / 180) * 111320;
    const ky = 110540;
    const ax = (a.lng - p.lng) * kx;
    const ay = (a.lat - p.lat) * ky;
    const bx = (b.lng - p.lng) * kx;
    const by = (b.lat - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    const x = ax + t * dx;
    const y = ay + t * dy;

    return {dist: Math.sqrt(x * x + y * y), t};
};

// Several stretches of a loop or an out-and-back pass the same spot: among those within this much
// of the nearest one, the one nearest the watch's distance wins.
const SAME_SPOT_M = 40;

/**
 * Where `p` is on the course. `hintAlong` (the watch's distance) picks the right stretch when the
 * course passes the same spot twice; without it, the earliest one.
 */
export const locateOnCourse = (p: LatLng, course: LoadedLiveCourse, hintAlong?: number | null): CoursePosition | null => {
    const {points, cum, total} = course;
    if (points.length < 2 || total <= 0) {
        return null;
    }

    const candidates: { along: number; dist: number }[] = [];
    let best = Infinity;
    for (let i = 1; i < points.length; i++) {
        const {dist, t} = segmentDistance(p, points[i - 1], points[i]);
        best = Math.min(best, dist);
        candidates.push({along: cum[i - 1] + t * (cum[i] - cum[i - 1]), dist});
    }

    const close = candidates.filter((candidate) => candidate.dist <= best + SAME_SPOT_M);
    const chosen = hintAlong != null && hintAlong > 0
        ? close.reduce((a, b) => (Math.abs(a.along - hintAlong) <= Math.abs(b.along - hintAlong) ? a : b))
        : close.reduce((a, b) => (a.along <= b.along ? a : b));

    return {courseId: course.id, along: chosen.along, off: best, share: Math.min(1, chosen.along / total)};
};

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * The participant's course: the one named in their ticket (« 21 km » in « Inscription 21 km »),
 * else the nearest one to where they are.
 */
export const pickCourse = (courses: LoadedLiveCourse[], productTitle: string | null | undefined, p: LatLng | null): LoadedLiveCourse | null => {
    if (courses.length <= 1) {
        return courses[0] ?? null;
    }

    if (productTitle) {
        const title = normalize(productTitle);
        const named = courses
            .filter((course) => course.label && title.includes(normalize(course.label)))
            .sort((a, b) => b.label.length - a.label.length);
        if (named.length > 0) {
            return named[0];
        }
    }

    if (!p) {
        return courses[0];
    }

    let nearest = courses[0];
    let nearestOff = Infinity;
    for (const course of courses) {
        const position = locateOnCourse(p, course);
        if (position && position.off < nearestOff) {
            nearest = course;
            nearestOff = position.off;
        }
    }

    return nearest;
};
