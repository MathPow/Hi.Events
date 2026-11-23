import {backtrackShare, bearing as bearingTo, destination, haversine, LatLng, overlapShare} from "./geo.ts";
import {fetchTrailPoints, snapToTrail} from "./places.ts";
import {CourseSurface, RoutedLine, routeThrough} from "./routing.ts";
import {CourseKind} from "./gpx.ts";

// Courses close to the distance asked for. A loop is a shape drawn around the start (a square on a
// circle through it, turned 8 ways), routed on real trails and streets, then grown or shrunk until the
// routed distance lands near the target. A line heads out the same 8 ways, or joins the given finish.

export interface CourseDraft {
    // The points the course goes through, start first. A loop comes back to the first one.
    waypoints: LatLng[];
    line: RoutedLine;
}

export interface ProposalRequest {
    kind: CourseKind;
    start: LatLng;
    finish?: LatLng;
    targetM: number;
    surface: CourseSurface;
}

const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
const MAX_PROPOSALS = 4;
const MAX_TRIES = 4;
const CLOSE_ENOUGH = 0.03;
const FAR_OFF = 0.2;
// Trails and streets wind: a route is longer than the straight shape it follows.
const LOOP_FACTOR = 1.25;
const LINE_FACTOR = 1.3;
// Past this, waypoints are left where they fall (Overpass would return too much).
const SNAP_MAX_RADIUS_M = 6000;

// Overpass is often slow: past a few seconds the proposals go without it (BRouter's trail profile
// already prefers paths). What came back is kept for the next search around the same start.
const TRAILS_DEADLINE_MS = 4000;
const trailCache = new Map<string, Promise<LatLng[]>>();

const trailsAround = (center: LatLng, radiusM: number): Promise<LatLng[]> => {
    const key = `${center.lat.toFixed(3)},${center.lng.toFixed(3)},${Math.ceil(radiusM / 500)}`;
    let request = trailCache.get(key);
    if (!request) {
        request = fetchTrailPoints(center, Math.ceil(radiusM / 500) * 500);
        request.then((points) => points.length === 0 && trailCache.delete(key));
        trailCache.set(key, request);
    }

    return Promise.race([
        request,
        new Promise<LatLng[]>((resolve) => setTimeout(() => resolve([]), TRAILS_DEADLINE_MS)),
    ]);
};

export const viaPoints = (kind: CourseKind, waypoints: LatLng[]): LatLng[] =>
    kind === 'loop' && waypoints.length > 1 ? [...waypoints, waypoints[0]] : waypoints;

export const routeDraft = async (kind: CourseKind, waypoints: LatLng[], surface: CourseSurface, signal?: AbortSignal): Promise<CourseDraft | null> => {
    const line = await routeThrough(viaPoints(kind, waypoints), surface, signal);

    return line ? {waypoints, line} : null;
};

// How far a draft is from what was asked: the distance gap, and running the same way twice.
const score = (draft: CourseDraft, targetM: number) =>
    Math.abs(draft.line.distance - targetM) / targetM + 0.6 * backtrackShare(draft.line.points);

const loopWaypoints = (start: LatLng, bearing: number, radius: number): LatLng[] => {
    const center = destination(start, bearing, radius);
    const startAngle = (bearing + 180) % 360;

    return [start, ...[90, 180, 270].map((turn) => destination(center, (startAngle + turn) % 360, radius))];
};

/** Proposals as they come, the best first, at most 4 different ones. */
export const proposeCourses = async (
    request: ProposalRequest,
    onUpdate: (drafts: CourseDraft[]) => void,
    signal: AbortSignal,
): Promise<CourseDraft[]> => {
    const {kind, start, finish, targetM, surface} = request;

    const reach = kind === 'loop' ? 2 * targetM / (5.66 * LOOP_FACTOR) : targetM / LINE_FACTOR;
    const trailPoints = surface !== 'road' && reach <= SNAP_MAX_RADIUS_M
        ? await trailsAround(start, Math.min(SNAP_MAX_RADIUS_M, reach * 1.6 + 300))
        : [];
    // The start, and a finish the organizer chose, stay exactly where they are.
    const snap = (points: LatLng[]) => points.map((p, index) => (
        index === 0 || (finish && index === points.length - 1) ? p : snapToTrail(p, trailPoints, 300)
    ));

    const found: CourseDraft[] = [];
    const publish = () => {
        const kept: CourseDraft[] = [];
        // A course far from the distance asked for only shows when nothing closer came back.
        const near = found.filter((draft) => Math.abs(draft.line.distance - targetM) / targetM <= FAR_OFF);
        for (const draft of (near.length > 0 ? near : found).sort((a, b) => score(a, targetM) - score(b, targetM))) {
            if (kept.length < MAX_PROPOSALS && kept.every((other) => overlapShare(draft.line.points, other.line.points) < 0.75)) {
                kept.push(draft);
            }
        }
        if (!signal.aborted) {
            onUpdate(kept);
        }
        return kept;
    };

    const refine = async (shape: (size: number) => LatLng[], initialSize: number) => {
        let size = initialSize;
        let best: CourseDraft | null = null;
        for (let attempt = 0; attempt < MAX_TRIES && !signal.aborted; attempt++) {
            const draft = await routeDraft(kind, snap(shape(size)), surface, signal);
            if (!draft) {
                size *= 0.8;
                continue;
            }
            if (!best || score(draft, targetM) < score(best, targetM)) {
                best = draft;
            }
            if (Math.abs(draft.line.distance - targetM) / targetM < CLOSE_ENOUGH) {
                break;
            }
            size *= Math.min(2, Math.max(0.5, targetM / draft.line.distance));
        }
        if (best) {
            found.push(best);
            publish();
        }
    };

    const tasks: Promise<void>[] = [];

    if (kind === 'loop') {
        const radius = targetM / (5.66 * LOOP_FACTOR);
        for (const bearing of BEARINGS) {
            tasks.push(refine((size) => loopWaypoints(start, bearing, size), radius));
        }
    } else if (finish) {
        // The direct way, then detours to one side and the other when the target is longer.
        const direct = await routeDraft(kind, [start, finish], surface, signal);
        if (direct) {
            found.push(direct);
            publish();
        }
        const directM = direct?.line.distance ?? haversine(start, finish) * LINE_FACTOR;
        if (targetM > directM * 1.08) {
            const heading = bearingTo(start, finish);
            const middle = {lat: (start.lat + finish.lat) / 2, lng: (start.lng + finish.lng) / 2};
            const detour = Math.sqrt(Math.max(0, (targetM / LINE_FACTOR) ** 2 - haversine(start, finish) ** 2)) / 2;
            for (const side of [90, -90]) {
                tasks.push(refine((size) => [start, destination(middle, heading + side, size), finish], detour));
            }
            for (const side of [45, -45, 135, -135]) {
                tasks.push(refine((size) => [start, destination(start, heading + side, size), finish], detour * 0.8));
            }
        }
    } else {
        for (const bearing of BEARINGS) {
            tasks.push(refine((size) => [start, destination(start, bearing, size)], targetM / LINE_FACTOR));
        }
    }

    await Promise.all(tasks);

    return publish();
};
