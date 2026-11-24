import {
    backtrackShare,
    bearing as bearingTo,
    cumulative,
    destination,
    findSpurs,
    haversine,
    LatLng,
    nearestAlong,
    overlapShare,
    pointAlong,
    selfCrossings,
} from "./geo.ts";
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

interface Shape {
    // The points to route through, for a shape of this size (metres).
    make: (size: number) => LatLng[];
    size: number;
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
// After every shape is tried once, the most promising ones are routed again, closer to the target.
const REFINED_SHAPES = 5;
const REFINE_TRIES = 2;
const CLOSE_ENOUGH = 0.03;
const FAR_OFF = 0.2;
const MAX_STRETCH = 2.5;
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
    if (!line) {
        return null;
    }

    // A point dropped off any path is joined from the nearest one: it moves onto the line it gave,
    // so every point to drag sits on the course.
    let fromIndex = 0;
    const onLine = waypoints.map((point) => {
        const hit = nearestAlong(point, line.points, fromIndex);
        fromIndex = hit.index;
        return hit.point;
    });

    return {waypoints: onLine, line};
};

// What the course should run on: trails for « Sentiers », away from busy roads for all three.
const SURFACE_WEIGHTS: Record<CourseSurface, { nature: number; busy: number }> = {
    trail: {nature: 0.5, busy: 0.3},
    mixed: {nature: 0.2, busy: 0.3},
    road: {nature: 0, busy: 0.2},
};

const spurLength = (points: LatLng[]) => findSpurs(points).reduce((sum, spur) => sum + spur.to - spur.from, 0);

// How far a draft is from what was asked: the distance gap, running the same way twice (dead ends run
// there and back), crossing itself, and what it runs on. Lower is better.
const scores = new WeakMap<CourseDraft, number>();
const score = (draft: CourseDraft, targetM: number, surface: CourseSurface) => {
    let value = scores.get(draft);
    if (value === undefined) {
        const {points, distance, nature, busy} = draft.line;
        const weights = SURFACE_WEIGHTS[surface];
        value = Math.abs(distance - targetM) / targetM
            + 0.6 * backtrackShare(points)
            + spurLength(points) / Math.max(distance, 1)
            + 0.05 * Math.min(4, selfCrossings(points))
            + weights.nature * (1 - (nature ?? 0.5))
            + weights.busy * (busy ?? 0);
        scores.set(draft, value);
    }

    return value;
};

// A point that BRouter could only reach at the end of a dead end (a parking lot, a cul-de-sac) makes
// the course run there and back: the point moves back to where the dead end leaves the course, and the
// course is routed again. The start, and a finish the organizer chose, stay where they are.
const withoutSpurs = async (
    draft: CourseDraft,
    kind: CourseKind,
    surface: CourseSurface,
    isFixed: (index: number) => boolean,
    signal: AbortSignal,
): Promise<CourseDraft> => {
    const line = draft.line.points;
    const spurs = findSpurs(line, 60);
    if (spurs.length === 0) {
        return draft;
    }

    const cum = cumulative(line);
    let fromIndex = 0;
    let moved = false;
    const waypoints = draft.waypoints.map((point, index) => {
        const hit = nearestAlong(point, line, fromIndex);
        fromIndex = hit.index;
        const spur = spurs.find((s) => hit.along > s.from - 20 && hit.along < s.to + 20);
        if (!spur || isFixed(index)) {
            return point;
        }
        moved = true;
        return pointAlong(line, cum, spur.from);
    });
    if (!moved) {
        return draft;
    }

    const again = await routeDraft(kind, waypoints, surface, signal);

    return again && spurLength(again.line.points) < spurLength(line) ? again : draft;
};

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
    const isFixed = (index: number, count: number) => index === 0 || (!!finish && index === count - 1);
    const snap = (points: LatLng[]) => points.map((p, index) => (
        isFixed(index, points.length) ? p : snapToTrail(p, trailPoints, 300)
    ));

    // The best draft of each shape, and the direct way between a start and a finish.
    const best = new Map<number, CourseDraft>();
    const extra: CourseDraft[] = [];
    const gap = (draft: CourseDraft) => Math.abs(draft.line.distance - targetM) / targetM;
    const rank = (draft: CourseDraft) => score(draft, targetM, surface);

    const publish = () => {
        const found = [...extra, ...best.values()];
        const kept: CourseDraft[] = [];
        // A course far from the distance asked for only shows when nothing closer came back.
        const near = found.filter((draft) => gap(draft) <= FAR_OFF);
        for (const draft of (near.length > 0 ? near : found).sort((a, b) => rank(a) - rank(b))) {
            if (kept.length < MAX_PROPOSALS && kept.every((other) => overlapShare(draft.line.points, other.line.points) < 0.75)) {
                kept.push(draft);
            }
        }
        if (!signal.aborted) {
            onUpdate(kept);
        }
        return kept;
    };

    // A shape routed at one size, its dead ends taken out, kept when it beats that shape's best so far.
    const attempt = async (index: number, shape: Shape, size: number): Promise<CourseDraft | null> => {
        const routed = await routeDraft(kind, snap(shape.make(size)), surface, signal);
        // A shape across a river comes back huge (the way round by a bridge): no course there.
        if (!routed || routed.line.distance > targetM * MAX_STRETCH) {
            return null;
        }
        const draft = await withoutSpurs(routed, kind, surface, (i) => isFixed(i, routed.waypoints.length), signal);
        const previous = best.get(index);
        if (!previous || rank(draft) < rank(previous)) {
            best.set(index, draft);
            publish();
        }
        return draft;
    };

    const shapes: Shape[] = [];
    if (kind === 'loop') {
        const radius = targetM / (5.66 * LOOP_FACTOR);
        for (const bearing of BEARINGS) {
            shapes.push({make: (size) => loopWaypoints(start, bearing, size), size: radius});
        }
    } else if (finish) {
        // The direct way, then detours to one side and the other when the target is longer.
        const direct = await routeDraft(kind, [start, finish], surface, signal);
        if (direct) {
            extra.push(direct);
            publish();
        }
        const directM = direct?.line.distance ?? haversine(start, finish) * LINE_FACTOR;
        if (targetM > directM * 1.08) {
            const heading = bearingTo(start, finish);
            const middle = {lat: (start.lat + finish.lat) / 2, lng: (start.lng + finish.lng) / 2};
            const detour = Math.sqrt(Math.max(0, (targetM / LINE_FACTOR) ** 2 - haversine(start, finish) ** 2)) / 2;
            for (const side of [90, -90]) {
                shapes.push({make: (size) => [start, destination(middle, heading + side, size), finish], size: detour});
            }
            for (const side of [45, -45, 135, -135]) {
                shapes.push({make: (size) => [start, destination(start, heading + side, size), finish], size: detour * 0.8});
            }
        }
    } else {
        for (const bearing of BEARINGS) {
            shapes.push({make: (size) => [start, destination(start, bearing, size)], size: targetM / LINE_FACTOR});
        }
    }

    // Every shape once at its estimated size (smaller when no route came back)…
    const firsts = await Promise.all(shapes.map(async (shape, index) => {
        let size = shape.size;
        let draft = await attempt(index, shape, size);
        if (!draft && !signal.aborted) {
            size *= 0.7;
            draft = await attempt(index, shape, size);
        }
        return {index, shape, size, draft};
    }));

    // …then the most promising ones, by how they run rather than how long they are, grow or shrink
    // until their distance lands near the target.
    const promising = firsts
        .filter((first): first is typeof first & { draft: CourseDraft } => first.draft !== null && gap(first.draft) >= CLOSE_ENOUGH)
        .sort((a, b) => (rank(a.draft) - gap(a.draft)) - (rank(b.draft) - gap(b.draft)))
        .slice(0, REFINED_SHAPES);
    await Promise.all(promising.map(async ({index, shape, size, draft}) => {
        let last = draft;
        let current = size;
        for (let i = 0; i < REFINE_TRIES && !signal.aborted && gap(last) >= CLOSE_ENOUGH; i++) {
            current *= Math.min(2, Math.max(0.5, targetM / last.line.distance));
            const next = await attempt(index, shape, current);
            if (!next) {
                break;
            }
            last = next;
        }
    }));

    return publish();
};
