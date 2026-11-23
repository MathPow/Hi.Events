import {useCallback, useEffect, useRef, useState} from "react";
import {LatLng, nearestAlong} from "../../../../utilites/course/geo.ts";
import {CourseKind} from "../../../../utilites/course/gpx.ts";
import {CourseSurface} from "../../../../utilites/course/routing.ts";
import {CourseDraft, routeDraft, viaPoints} from "../../../../utilites/course/proposals.ts";

const MAX_HISTORY = 30;

/**
 * The course being edited: its points, the line routed through them, and every change undoable.
 * Each change routes again; an answer that comes back after a newer change is dropped.
 */
export const useCourseEditor = (kind: CourseKind, surface: CourseSurface) => {
    const [draft, setDraft] = useState<CourseDraft | null>(null);
    const history = useRef<CourseDraft[]>([]);
    const [undoCount, setUndoCount] = useState(0);
    const [routing, setRouting] = useState(false);
    const [failed, setFailed] = useState(false);
    const sequence = useRef(0);
    const latest = useRef<CourseDraft | null>(null);
    latest.current = draft;

    useEffect(() => () => {
        sequence.current++;
    }, []);

    const remember = useCallback((previous: CourseDraft) => {
        history.current = [...history.current.slice(-MAX_HISTORY + 1), previous];
        setUndoCount(history.current.length);
    }, []);

    /** A course from elsewhere (a proposal, a saved file): nothing to undo yet. */
    const load = useCallback((next: CourseDraft | null) => {
        sequence.current++;
        setRouting(false);
        setFailed(false);
        history.current = [];
        setUndoCount(0);
        setDraft(next);
    }, []);

    const reroute = useCallback(async (waypoints: LatLng[]) => {
        const current = latest.current;
        const run = ++sequence.current;
        setRouting(true);
        setFailed(false);
        const next = await routeDraft(kind, waypoints, surface).catch(() => null);
        if (run !== sequence.current) {
            return;
        }
        setRouting(false);
        if (!next) {
            setFailed(true);
            return;
        }
        if (current) {
            remember(current);
        }
        setDraft(next);
    }, [kind, surface, remember]);

    const move = useCallback((index: number, position: LatLng) => {
        const current = latest.current;
        if (!current) {
            return;
        }
        const waypoints = current.waypoints.map((p, i) => (i === index ? position : p));
        void reroute(waypoints);
    }, [reroute]);

    const remove = useCallback((index: number) => {
        const current = latest.current;
        if (!current || index === 0 || current.waypoints.length <= 2) {
            return;
        }
        void reroute(current.waypoints.filter((_, i) => i !== index));
    }, [reroute]);

    /** A point added where the line was clicked, in the right place among the others; the line stays as it is. */
    const insertOnLine = useCallback((position: LatLng) => {
        const current = latest.current;
        if (!current) {
            return;
        }

        const line = current.line.points;
        const via = viaPoints(kind, current.waypoints);
        // How far along the line each point is: the new one goes before the first that is further.
        let fromIndex = 0;
        const alongs = via.map((p) => {
            const hit = nearestAlong(p, line, fromIndex);
            fromIndex = hit.index;
            return hit.along;
        });
        const clicked = nearestAlong(position, line);
        let insertAt = alongs.findIndex((along, i) => i > 0 && along > clicked.along);
        if (insertAt === -1) {
            insertAt = via.length - 1;
        }
        // A loop's last stop is its start again: insert among the real points.
        insertAt = Math.min(insertAt, current.waypoints.length - (kind === 'line' ? 1 : 0));
        insertAt = Math.max(1, insertAt);

        const waypoints = [...current.waypoints.slice(0, insertAt), clicked.point, ...current.waypoints.slice(insertAt)];
        remember(current);
        setDraft({waypoints, line: current.line});
    }, [kind, remember]);

    /** Drawing by hand: each click is the next point (the course still comes back to its start for a loop). */
    const append = useCallback((position: LatLng, start: LatLng) => {
        const current = latest.current;
        const waypoints = current ? [...current.waypoints, position] : [start, position];
        void reroute(waypoints);
    }, [reroute]);

    const undo = useCallback(() => {
        const last = history.current[history.current.length - 1];
        if (!last) {
            return;
        }
        sequence.current++;
        history.current = history.current.slice(0, -1);
        setUndoCount(history.current.length);
        setRouting(false);
        setFailed(false);
        setDraft(last);
    }, []);

    /** The same points routed again, for another surface. */
    const rerouteAll = useCallback(() => {
        const current = latest.current;
        if (current) {
            void reroute(current.waypoints);
        }
    }, [reroute]);

    return {draft, routing, failed, canUndo: undoCount > 0, load, move, remove, insertOnLine, append, undo, rerouteAll};
};
