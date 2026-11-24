import {CSSProperties, ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Link, useBlocker} from "react-router";
import {t} from "@lingui/macro";
import {Button, Loader, NumberInput, SegmentedControl, Skeleton, Text, TextInput, UnstyledButton} from "@mantine/core";
import {modals} from "@mantine/modals";
import {
    IconArrowBackUp,
    IconCheck,
    IconCircleCheck,
    IconClick,
    IconDownload,
    IconHandGrab,
    IconHelp,
    IconMapPin,
    IconPencil,
    IconPlus,
    IconSparkles,
    IconX,
} from "@tabler/icons-react";
import type {Map as MapLibreMap, MapMouseEvent, Marker, Popup} from "maplibre-gl";
import {IdParam} from "../../../../types.ts";
import {boundsOf, elevationGain, haversine, LatLng, pathDistance, simplify} from "../../../../utilites/course/geo.ts";
import {buildGpx, CourseKind, downloadGpx, gpxFileName, ParsedGpx} from "../../../../utilites/course/gpx.ts";
import {CourseSurface} from "../../../../utilites/course/routing.ts";
import {CourseDraft, proposeCourses} from "../../../../utilites/course/proposals.ts";
import {unansweredRoutingRequests} from "../../../../utilites/course/routing.ts";
import {EventRouteFile} from "../../../../api/eventRouteFile.client.ts";
import {useReplaceEventRouteFile, useUploadEventRouteFile} from "../../../../mutations/useEventRouteFileMutations.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {CONFIRM_GROUP_PROPS, confirmationDialog} from "../../../../utilites/confirmationDialog.tsx";
import {
    COURSE_LAYER,
    hoverProposal,
    loadCourseMap,
    PROPOSAL_COLORS,
    PROPOSAL_LABELS_LAYER,
    proposalLetter,
    PROPOSALS_LAYER,
    showCourse,
    showProposals,
} from "../../../common/CourseMap/courseLayers.ts";
import {ElevationProfile} from "../../../common/CourseMap/ElevationProfile.tsx";
import {CourseShape} from "../../../common/CourseMap/CourseShape.tsx";
import {formatClimb, formatGap, formatKm} from "../../../common/CourseMap/courseFormat.ts";
import {eventSettingsTabPath} from "../Settings/settingsTabs.ts";
import {Place, PlaceInput} from "./PlaceInput.tsx";
import {useCourseEditor} from "./useCourseEditor.ts";
import {intlLocale} from "../../../../utilites/intlLocale.ts";
import classes from "./Courses.module.scss";

export interface CourseToEdit {
    routeFile: EventRouteFile;
    gpx: ParsedGpx;
}

/** What the next route starts from: the same start, kind, distance and terrain as the one just saved. */
export interface CourseSetup {
    kind: CourseKind;
    surface: CourseSurface;
    targetKm: number | string;
    start: Place | null;
    finish: Place | null;
}

export interface SavedCourse {
    id?: number;
    label: string;
    setup: CourseSetup;
}

interface CourseMakerProps {
    eventId: IdParam;
    eventPlace?: Place;
    editing: CourseToEdit | null;
    // The setup kept from the route just saved, and its name for the confirmation.
    setup?: CourseSetup | null;
    savedLabel?: string | null;
    full: boolean;
    onDone: (saved?: SavedCourse) => void;
    // What leaving would lose: changes to a route, or a route not added yet.
    onDirtyChange?: (pending: PendingRoute) => void;
    onSetupChange?: (setup: CourseSetup) => void;
}

export type PendingRoute = 'changes' | 'not-added' | null;

const QUICK_DISTANCES = [5, 6.7, 10, 21.1, 42.2];
// Within 50 m of the distance asked for: « Pile la distance » rather than « +0,0 km ».
const ON_TARGET_M = 50;
// Past this, a search tells the organizer it is still going.
const SLOW_SEARCH_MS = 4000;
const LEGEND_KEY = 'dehors-course-legend-hidden';
// eslint-disable-next-line lingui/no-unlocalized-strings -- a media query
const PHONE_QUERY = '(max-width: 767px)';
// One arrow key press moves a point this far on the screen.
const NUDGE_PX = 12;
const ARROWS: Record<string, [number, number]> = {ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0]};

type Picking = 'start' | 'finish' | null;

const colorOf = (index: number | null) => PROPOSAL_COLORS[(index ?? 0) % PROPOSAL_COLORS.length];
const DRAWN_COLOR = '#352924';

const kmText = (km: number) => new Intl.NumberFormat(intlLocale(), {maximumFractionDigits: 1}).format(km);

// « 6,7 » in French, « 6.7 » in English: the field shows the page's separator and takes either one.
const decimalSeparator = () =>
    new Intl.NumberFormat(intlLocale()).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';

const gapText = (metres: number) => Math.abs(metres) < ON_TARGET_M ? t`Right on the distance` : formatGap(metres);

// Closed until asked for on a phone, where the map is small; open elsewhere until closed.
const readLegendHidden = () => {
    const small = typeof window !== 'undefined' && window.matchMedia?.(PHONE_QUERY).matches;
    try {
        const stored = window.localStorage.getItem(LEGEND_KEY);
        return stored === null ? !!small : stored === '1';
    } catch {
        return !!small;
    }
};

/** An edited GPX: its control points when Dehors drew it, else points picked along its line. */
const draftFromGpx = (gpx: ParsedGpx): { draft: CourseDraft; kind: CourseKind; surface: CourseSurface; targetM?: number } => {
    const line = {points: gpx.points, distance: pathDistance(gpx.points), ascent: gpx.design?.ascentM ?? elevationGain(gpx.points)};
    if (gpx.design) {
        return {draft: {waypoints: gpx.design.waypoints, line}, kind: gpx.design.kind, surface: gpx.design.surface, targetM: gpx.design.targetM};
    }

    const first = gpx.points[0];
    const last = gpx.points[gpx.points.length - 1];
    const kind: CourseKind = haversine(first, last) < 80 ? 'loop' : 'line';
    let tolerance = 25;
    let waypoints = simplify(gpx.points, tolerance);
    while (waypoints.length > 18) {
        tolerance *= 1.6;
        waypoints = simplify(gpx.points, tolerance);
    }
    if (kind === 'loop' && waypoints.length > 2) {
        waypoints = waypoints.slice(0, -1);
    }

    return {draft: {waypoints, line}, kind, surface: 'mixed'};
};

/** A numbered step of the panel: its number turns into a check once it is done. */
const Step = ({number, title, done, action, children}: {
    number: number;
    title: string;
    done: boolean;
    action?: ReactNode;
    children: ReactNode;
}) => (
    <section className={classes.step}>
        <header className={classes.stepHead}>
            <span className={classes.stepNumber} data-rough data-done={done || undefined} aria-hidden>
                {done ? <IconCheck size={14} stroke={3}/> : number}
            </span>
            <h3 className={classes.stepTitle}>{title}</h3>
            {action}
        </header>
        {children}
    </section>
);

export const CourseMaker = ({eventId, eventPlace, editing, setup, savedLabel, full, onDone, onDirtyChange, onSetupChange}: CourseMakerProps) => {
    const container = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<MapLibreMap | null>(null);
    const maplibre = useRef<typeof import('maplibre-gl') | null>(null);
    const [mapFailed, setMapFailed] = useState(false);

    const initial = useMemo(() => (editing ? draftFromGpx(editing.gpx) : null), [editing]);

    const [kind, setKind] = useState<CourseKind>(initial?.kind ?? setup?.kind ?? 'loop');
    const [surface, setSurface] = useState<CourseSurface>(initial?.surface ?? setup?.surface ?? 'trail');
    const [targetKm, setTargetKm] = useState<number | string>(
        initial?.targetM ? Math.round(initial.targetM / 100) / 10 : initial ? Math.round(initial.draft.line.distance / 100) / 10 : setup?.targetKm ?? 5,
    );
    const [start, setStart] = useState<Place | null>(
        initial ? {label: t`Start of the route`, position: initial.draft.waypoints[0]} : setup?.start ?? eventPlace ?? null,
    );
    const [finish, setFinish] = useState<Place | null>(
        initial?.kind === 'line'
            ? {label: t`Finish of the route`, position: initial.draft.waypoints[initial.draft.waypoints.length - 1]}
            : setup?.finish ?? null,
    );
    const [justSaved, setJustSaved] = useState(savedLabel ?? null);
    const [searchFailed, setSearchFailed] = useState(false);
    const [markersRound, setMarkersRound] = useState(0);
    const [picking, setPicking] = useState<Picking>(null);
    const [drawing, setDrawing] = useState(false);
    const [proposals, setProposals] = useState<CourseDraft[]>([]);
    const [generating, setGenerating] = useState(false);
    const [slow, setSlow] = useState(false);
    const [searched, setSearched] = useState(false);
    const [selected, setSelected] = useState<number | null>(null);
    const [hovered, setHovered] = useState<number | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [legendHidden, setLegendHidden] = useState(readLegendHidden);
    const [failedShown, setFailedShown] = useState(false);
    const [name, setName] = useState(editing?.routeFile.label ?? '');
    const [nameTouched, setNameTouched] = useState(!!editing);
    const generation = useRef<AbortController | null>(null);

    const editor = useCourseEditorFor(kind, surface, initial?.draft ?? null);
    const {draft, load, move, remove, insertOnLine, append, rerouteAll} = editor;
    // A proposal keeps its colour; a route drawn by hand, or a saved one, is in the page's ink.
    const color = selected === null ? DRAWN_COLOR : colorOf(selected);
    // Left at « 6, » the field holds the text « 6. »: still 6 km.
    const askedKm = typeof targetKm === 'number' ? targetKm : parseFloat(targetKm);
    const targetM = Number.isFinite(askedKm) && askedKm > 0 ? askedKm * 1000 : 0;

    // The course as it came (a proposal, the saved file): anything else is work that a new search would lose.
    const pristine = useRef<CourseDraft | null>(initial?.draft ?? null);
    const nameChanged = !!editing && name.trim() !== editing.routeFile.label;
    const dirty = (!!draft && draft !== pristine.current) || nameChanged;
    // What leaving the page would lose: a route not added yet, or the changes to the one being edited.
    const unsaved = editing ? dirty : !!draft;

    const uploadMutation = useUploadEventRouteFile();
    const replaceMutation = useReplaceEventRouteFile();
    const saving = uploadMutation.isPending || replaceMutation.isPending;

    // The default name follows the course until the organizer types one.
    useEffect(() => {
        if (nameTouched || !draft) {
            return;
        }
        const km = kmText(Math.round(draft.line.distance / 100) / 10);
        setName(kind === 'loop' ? t`${km} km loop` : t`${km} km route`);
    }, [draft, kind, nameTouched]);

    useEffect(() => {
        onDirtyChange?.(unsaved ? (dirty ? 'changes' : 'not-added') : null);
    }, [unsaved, dirty, onDirtyChange]);

    useEffect(() => {
        onSetupChange?.({kind, surface, targetKm, start, finish});
    }, [kind, surface, targetKm, start, finish, onSetupChange]);

    // ---- leaving with a course not saved ----

    const blocker = useBlocker(({currentLocation, nextLocation}) =>
        unsaved && !saving && currentLocation.pathname !== nextLocation.pathname);

    useEffect(() => {
        if (blocker.state !== 'blocked') {
            return;
        }
        let leaving = false;
        modals.openConfirmModal({
            title: t`Leave without saving the route?`,
            children: <Text size="sm">{t`The route in progress will be lost.`}</Text>,
            labels: {confirm: t`Leave`, cancel: t`Stay`},
            groupProps: CONFIRM_GROUP_PROPS,
            onConfirm: () => {
                leaving = true;
                blocker.proceed?.();
            },
            onClose: () => !leaving && blocker.reset?.(),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [blocker.state]);

    useEffect(() => {
        if (!unsaved) {
            return;
        }
        const warn = (beforeUnload: BeforeUnloadEvent) => beforeUnload.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [unsaved]);

    // ---- the map ----

    useEffect(() => {
        const element = container.current;
        if (!element) {
            return;
        }
        let cancelled = false;
        let created: MapLibreMap | undefined;
        const center = initial?.draft.waypoints[0] ?? start?.position;

        loadCourseMap(element, center ? {center: [center.lng, center.lat], zoom: 14} : {})
            .then(({map: loaded, maplibregl}) => {
                if (cancelled) {
                    loaded.remove();
                    return;
                }
                created = loaded;
                maplibre.current = maplibregl;
                loaded.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
                // No compass to turn it back: the map stays north up.
                loaded.dragRotate.disable();
                loaded.keyboard.disableRotation();
                loaded.touchZoomRotate.disableRotation();
                loaded.touchPitch.disable();
                setMap(loaded);
            })
            .catch(() => !cancelled && setMapFailed(true));

        return () => {
            cancelled = true;
            created?.remove();
        };
        // The map is made once; the course and the markers follow the state below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fitTo = useCallback((points: LatLng[]) => {
        const bounds = boundsOf(points);
        if (map && bounds) {
            map.fitBounds(bounds, {padding: 60, maxZoom: 16, duration: 600});
        }
    }, [map]);

    // An edited course shows whole when the map is ready.
    useEffect(() => {
        if (map && initial) {
            fitTo(initial.draft.line.points);
        }
    }, [map, initial, fitTo]);

    useEffect(() => {
        if (map) {
            // Behind any route on the map: the proposals stay as faded alternatives.
            showProposals(map, proposals.map((proposal) => proposal.line.points), draft ? selected : null, drawing || !!draft);
        }
    }, [map, proposals, selected, draft, drawing]);

    useEffect(() => {
        if (map) {
            hoverProposal(map, hovered, proposals.length);
        }
    }, [map, hovered, proposals]);

    useEffect(() => {
        if (map) {
            showCourse(map, draft?.line.points ?? [], color);
        }
    }, [map, draft, color]);

    // A point the router could not reach: said for a moment, then the map is clear again.
    useEffect(() => {
        if (!editor.failed) {
            setFailedShown(false);
            return;
        }
        setFailedShown(true);
        const timer = window.setTimeout(() => setFailedShown(false), 5000);
        return () => window.clearTimeout(timer);
    }, [editor.failed]);

    // ---- replacing a course that was worked on ----

    // The latest state, for the map's own event handlers.
    const state = useRef({draft, picking, drawing, start, finish, kind, proposals, dirty, generating});
    state.current = {draft, picking, drawing, start, finish, kind, proposals, dirty, generating};

    const guard = useCallback((action: () => void) => {
        if (!state.current.dirty) {
            action();
            return;
        }
        confirmationDialog(t`Replace the route in progress? Your changes will be lost.`, action,
            {confirm: t`Replace`, cancel: t`Keep it`});
    }, []);

    const stopSearch = useCallback((keepSearched: boolean) => {
        generation.current?.abort();
        generation.current = null;
        setGenerating(false);
        if (!keepSearched) {
            setSearched(false);
        }
    }, []);

    // A new start or finish: the route being made follows it, and proposals made for the old one go.
    // A chosen address also brings the map there (not a flag being dragged or nudged).
    const changeEnd = useCallback((end: 'start' | 'finish', place: Place | null, follow = false) => {
        (end === 'start' ? setStart : setFinish)(place);
        setPicking(null);
        setSearchFailed(false);
        const current = state.current;
        if (!place) {
            return;
        }
        if (current.proposals.length > 0 || current.generating) {
            stopSearch(false);
            setProposals([]);
            setSelected(null);
        }
        if (current.draft && (end === 'start' || current.kind === 'line')) {
            move(end === 'start' ? 0 : current.draft.waypoints.length - 1, place.position);
        } else if (follow && map && end === 'start') {
            map.flyTo({center: [place.position.lng, place.position.lat], zoom: Math.max(map.getZoom(), 14), duration: 700});
        }
    }, [map, move, stopSearch]);

    // Each route remembers the start and finish it was made for: undoing a change, or a change the
    // router refused, brings the fields back with the route.
    const endsOf = useRef(new WeakMap<CourseDraft, { start: Place | null; finish: Place | null }>());
    useEffect(() => {
        if (!draft) {
            return;
        }
        const recorded = endsOf.current.get(draft);
        if (!recorded) {
            endsOf.current.set(draft, {start: state.current.start, finish: state.current.finish});
            return;
        }
        setStart(recorded.start);
        setFinish(recorded.finish);
    }, [draft]);
    useEffect(() => {
        if (editor.failed) {
            focusAfter.current = null;
            // A point or flag dropped where no path goes goes back to its place on the route.
            setMarkersRound((value) => value + 1);
        }
        const recorded = editor.failed && draft ? endsOf.current.get(draft) : undefined;
        if (recorded) {
            setStart(recorded.start);
            setFinish(recorded.finish);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor.failed]);

    const placeStart = useCallback((position: LatLng) => {
        changeEnd('start', {label: t`Point on the map`, position});
    }, [changeEnd]);

    const selectProposal = useCallback((index: number) => {
        const proposal = state.current.proposals[index];
        if (!proposal || state.current.draft === proposal) {
            return;
        }
        guard(() => {
            // The list stops moving once one is picked: its letter stays on its route.
            if (state.current.generating) {
                stopSearch(true);
            }
            pristine.current = proposal;
            setSelected(index);
            setDrawing(false);
            load(proposal);
        });
    }, [load, guard, stopSearch]);

    useEffect(() => {
        if (!map) {
            return;
        }

        const hit = (event: MapMouseEvent, layer: string) => map.getLayer(layer)
            ? map.queryRenderedFeatures([[event.point.x - 6, event.point.y - 6], [event.point.x + 6, event.point.y + 6]], {layers: [layer]})
            : [];
        const proposalAt = (event: MapMouseEvent) => {
            const feature = hit(event, PROPOSAL_LABELS_LAYER)[0] ?? hit(event, PROPOSALS_LAYER)[0];
            return feature ? Number(feature.properties?.index) : null;
        };

        const onClick = (event: MapMouseEvent) => {
            const position = {lat: event.lngLat.lat, lng: event.lngLat.lng};
            const current = state.current;

            if (current.picking === 'start') {
                placeStart(position);
                return;
            }
            if (current.picking === 'finish') {
                changeEnd('finish', {label: t`Point on the map`, position});
                return;
            }
            if (current.drawing) {
                if (!current.start && !current.draft) {
                    placeStart(position);
                    return;
                }
                append(position, current.draft?.waypoints[0] ?? current.start!.position);
                return;
            }
            const proposal = proposalAt(event);
            if (current.draft && hit(event, COURSE_LAYER).length > 0) {
                insertOnLine(position);
                return;
            }
            if (proposal !== null) {
                selectProposal(proposal);
                return;
            }
            if (!current.start && !current.draft) {
                placeStart(position);
            }
        };

        const onMove = (event: MapMouseEvent) => {
            const current = state.current;
            const proposal = current.drawing ? null : proposalAt(event);
            const over = proposal !== null || hit(event, COURSE_LAYER).length > 0;
            setHovered(proposal);
            map.getCanvas().style.cursor = current.picking || current.drawing ? 'crosshair' : over ? 'pointer' : '';
        };
        const onLeave = () => setHovered(null);

        map.on('click', onClick);
        map.on('mousemove', onMove);
        map.on('mouseout', onLeave);
        return () => {
            map.off('click', onClick);
            map.off('mousemove', onMove);
            map.off('mouseout', onLeave);
        };
    }, [map, append, insertOnLine, placeStart, selectProposal, changeEnd]);

    // ---- markers: the start, the finish, and the points to drag ----

    // With a route, its flags sit on its own points: a new start in the field doesn't redraw them
    // before the route has followed (a dragged flag would jump back meanwhile).
    const flagStart = draft ? null : start;
    const flagFinish = draft ? null : finish;
    const markers = useRef<Marker[]>([]);
    const popup = useRef<Popup | null>(null);
    const focusAfter = useRef<string | null>(null);
    useEffect(() => {
        const lib = maplibre.current;
        if (!map || !lib) {
            return;
        }
        // The point that had the keyboard keeps it once the markers are made again (after « Retirer ce
        // point », the one before it).
        // Not if the organizer has moved on to another field in the meantime.
        const active = document.activeElement;
        const onMap = map.getContainer().contains(active) || active === document.body;
        const focused = onMap
            ? focusAfter.current ?? (active as HTMLElement | null)?.dataset?.point
            : undefined;
        focusAfter.current = null;
        markers.current.forEach((marker) => marker.remove());
        markers.current = [];
        popup.current?.remove();

        const add = (element: HTMLElement, position: LatLng, onDrag: ((p: LatLng) => void) | null) => {
            const marker = new lib.Marker({element, draggable: !!onDrag, anchor: element.dataset.anchor === 'bottom' ? 'bottom' : 'center'})
                .setLngLat([position.lng, position.lat])
                .addTo(map);
            if (onDrag) {
                marker.on('dragend', () => {
                    const {lng, lat} = marker.getLngLat();
                    onDrag({lat, lng});
                });
                // The arrow keys move it a little (Shift: more), like a drag.
                element.addEventListener('keydown', (event) => {
                    const step = ARROWS[event.key];
                    if (!step) {
                        return;
                    }
                    // The map would move (or turn) with the same keys.
                    event.preventDefault();
                    event.stopPropagation();
                    const at = map.project([position.lng, position.lat]);
                    const size = event.shiftKey ? NUDGE_PX * 4 : NUDGE_PX;
                    const next = map.unproject([at.x + step[0] * size, at.y + step[1] * size]);
                    onDrag({lat: next.lat, lng: next.lng});
                });
            }
            markers.current.push(marker);
            return marker;
        };

        // MapLibre places a marker with its own transform: the look goes on an element inside it.
        const flag = (text: string, tone: 'start' | 'finish') => {
            const element = document.createElement('div');
            element.className = classes.flagMarker;
            element.dataset.anchor = 'bottom';
            element.dataset.point = tone;
            element.tabIndex = 0;
            element.setAttribute('role', 'button');
            element.setAttribute('aria-label', t`${text}: drag it or use the arrow keys to move it.`);
            const pill = document.createElement('span');
            pill.className = classes.flag;
            pill.dataset.tone = tone;
            pill.textContent = text;
            element.appendChild(pill);
            return element;
        };

        // A click (or a tap) on a point offers to take it out: a double-click is no use on a phone.
        const offerRemoval = (index: number, position: LatLng) => {
            popup.current?.remove();
            const button = document.createElement('button');
            button.type = 'button';
            button.className = classes.popupButton;
            button.textContent = t`Remove this point`;
            button.addEventListener('click', () => {
                popup.current?.remove();
                focusAfter.current = index > 1 ? String(index - 1) : 'start';
                remove(index);
            });
            popup.current = new lib.Popup({closeButton: false, offset: 18, className: classes.popup, focusAfterOpen: true})
                .setLngLat([position.lng, position.lat])
                .setDOMContent(button)
                .addTo(map);
            // The pill around « Retirer ce point » gets the hand-cut edge too.
            popup.current.getElement().querySelector<HTMLElement>('.maplibregl-popup-content')?.setAttribute('data-rough', '');
        };

        if (draft) {
            const last = draft.waypoints.length - 1;
            const canRemove = draft.waypoints.length > 2;
            draft.waypoints.forEach((point, index) => {
                if (index === 0) {
                    // Moving a route's flag changes that route, like any of its points: the proposals stay,
                    // each with the start it was made from.
                    add(flag(kind === 'loop' ? t`Start and finish` : t({message: 'Start', context: 'course'}), 'start'), point, (p) => {
                        setPicking(null);
                        setStart({label: t`Point on the map`, position: p});
                        move(0, p);
                    });
                    return;
                }
                if (kind === 'line' && index === last) {
                    add(flag(t`Finish`, 'finish'), point, (p) => {
                        setPicking(null);
                        setFinish({label: t`Point on the map`, position: p});
                        move(index, p);
                    });
                    return;
                }
                const element = document.createElement('button');
                element.type = 'button';
                element.className = classes.handle;
                element.style.setProperty('--handle-color', color);
                const dot = document.createElement('span');
                dot.className = classes.handleDot;
                element.appendChild(dot);
                element.dataset.point = String(index);
                element.title = t`Drag to move · click to remove`;
                element.setAttribute('aria-label', t`Point ${index} of the route: drag it or use the arrow keys to move it, Delete key to remove it.`);
                let dragged = false;
                element.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (dragged) {
                        dragged = false;
                        return;
                    }
                    if (canRemove) {
                        offerRemoval(index, point);
                    }
                });
                element.addEventListener('dblclick', (event) => {
                    event.stopPropagation();
                    remove(index);
                });
                element.addEventListener('keydown', (event) => {
                    if (event.key === 'Delete' || event.key === 'Backspace') {
                        event.preventDefault();
                        event.stopPropagation();
                        focusAfter.current = index > 1 ? String(index - 1) : 'start';
                        remove(index);
                    }
                });
                const marker = add(element, point, (p) => move(index, p));
                marker.on('dragstart', () => {
                    dragged = true;
                    popup.current?.remove();
                });
                // The click that ends a drag comes right after it, if at all.
                marker.on('dragend', () => window.setTimeout(() => {
                    dragged = false;
                }, 0));
            });
        } else {
            if (flagStart) {
                add(flag(kind === 'loop' ? t`Start and finish` : t({message: 'Start', context: 'course'}), 'start'), flagStart.position,
                    (p) => changeEnd('start', {label: t`Point on the map`, position: p}));
            }
            if (kind === 'line' && flagFinish) {
                add(flag(t`Finish`, 'finish'), flagFinish.position, (p) => changeEnd('finish', {label: t`Point on the map`, position: p}));
            }
        }

        if (focused) {
            const elements = markers.current.map((marker) => marker.getElement());
            const numbered = Number(focused);
            // A point removed from the keyboard: the one before it takes the focus.
            const target = elements.find((element) => element.dataset.point === focused)
                ?? (Number.isFinite(numbered) ? elements.find((element) => element.dataset.point === String(numbered - 1)) : undefined)
                ?? elements.find((element) => element.dataset.point === 'start');
            target?.focus({preventScroll: true});
        }
    }, [map, draft, flagStart, flagFinish, kind, color, move, remove, changeEnd, markersRound]);

    useEffect(() => () => {
        markers.current.forEach((marker) => marker.remove());
        popup.current?.remove();
    }, []);

    // ---- proposals ----

    useEffect(() => {
        if (!generating) {
            setSlow(false);
            return;
        }
        const timer = window.setTimeout(() => setSlow(true), SLOW_SEARCH_MS);
        return () => window.clearTimeout(timer);
    }, [generating]);

    const runSearch = async () => {
        if (!start || targetM <= 0) {
            return;
        }
        generation.current?.abort();
        const controller = new AbortController();
        generation.current = controller;

        setGenerating(true);
        setSearched(true);
        setSearchFailed(false);
        setJustSaved(null);
        setExpanded(false);
        setDrawing(false);
        setSelected(null);
        setHovered(null);
        setProposals([]);
        pristine.current = null;
        load(null);

        // Each proposal remembers the start and finish it was made from.
        const ends = {start, finish: kind === 'line' ? finish : null};
        // The map shows the first proposals as soon as they come, then all of them at the end.
        let shown = false;
        const onUpdate = (found: CourseDraft[]) => {
            found.forEach((proposal) => endsOf.current.has(proposal) || endsOf.current.set(proposal, ends));
            setProposals(found);
            if (!shown && found.length > 0) {
                shown = true;
                fitTo(found.flatMap((proposal) => proposal.line.points));
            }
        };

        try {
            const result = await proposeCourses(
                {kind, start: start.position, finish: kind === 'line' ? finish?.position : undefined, targetM, surface},
                onUpdate,
                controller.signal,
            );
            if (!controller.signal.aborted) {
                fitTo(result.flatMap((proposal) => proposal.line.points));
                // Nothing found because no router answered: that is not « no route from here ».
                if (result.length === 0 && unansweredRoutingRequests(controller.signal) > 0) {
                    setSearchFailed(true);
                }
            }
        } catch {
            // Stopped or replaced by a newer search: nothing to say. Otherwise the router could not be reached.
            if (!controller.signal.aborted) {
                setSearchFailed(true);
            }
        } finally {
            if (generation.current === controller) {
                setGenerating(false);
            }
        }
    };

    const propose = () => guard(() => void runSearch());

    useEffect(() => () => generation.current?.abort(), []);

    // The proposals stay behind, faded: cancelling the drawing brings them back.
    const startDrawing = () => guard(() => {
        stopSearch(true);
        setSearchFailed(false);
        setSelected(null);
        setExpanded(false);
        setJustSaved(null);
        pristine.current = null;
        load(null);
        setDrawing(true);
    });

    const startOver = () => {
        setSearchFailed(false);
        generation.current?.abort();
        setGenerating(false);
        setProposals([]);
        setSearched(false);
        setSelected(null);
        setDrawing(false);
        setNameTouched(!!editing);
        pristine.current = null;
        load(null);
    };

    // Another surface routes the same points again on the paths it prefers.
    const routedSurface = useRef(surface);
    useEffect(() => {
        if (routedSurface.current !== surface) {
            routedSurface.current = surface;
            rerouteAll();
        }
    }, [surface, rerouteAll]);

    const hideLegend = (hidden: boolean) => {
        setLegendHidden(hidden);
        try {
            window.localStorage.setItem(LEGEND_KEY, hidden ? '1' : '0');
        } catch {
            // private window: the choice lasts until the page closes
        }
    };

    // ---- saving ----

    const gpxText = () => draft ? buildGpx(name.trim() || gpxFileName(''), draft.line.points, {
        kind,
        surface,
        targetM: targetM || undefined,
        ascentM: draft.line.ascent,
        waypoints: draft.waypoints,
    }) : '';

    const save = async () => {
        if (!draft) {
            return;
        }
        const label = name.trim();
        const file = new File([gpxText()], gpxFileName(label), {type: 'application/gpx+xml'});
        // The next route starts where this one did.
        const kept: CourseSetup = {kind, surface, targetKm, start, finish};
        try {
            if (editing) {
                await replaceMutation.mutateAsync({eventId, routeFileId: editing.routeFile.id, file, label});
                pristine.current = draft;
                showSuccess(t`Route saved. Participants download the new version.`);
                onDone({id: editing.routeFile.id, label, setup: kept});
            } else {
                const response = await uploadMutation.mutateAsync({eventId, file, label});
                pristine.current = draft;
                showSuccess(t`Route added. Participants can download it from their ticket.`);
                onDone({id: response?.data?.id, label, setup: kept});
            }
        } catch (error: any) {
            const messages = error?.response?.data?.errors?.file;
            showError(messages?.[0] ?? t`The route could not be saved. Please try again.`);
        }
    };


    // ---- the panel ----

    const gap = draft && targetM ? draft.line.distance - targetM : 0;
    const draftClimb = draft ? formatClimb(draft.line.ascent) : '';
    const gapClose = targetM > 0 && Math.abs(gap) / targetM <= 0.05;
    const setupDone = (!!start || !!draft) && targetM > 0;
    const collapsed = setupDone && (searched || drawing || !!draft) && !expanded;
    const kindLabel = kind === 'loop' ? t`Loop` : t`Point to point`;
    const surfaceLabel = surface === 'trail' ? t`Trails` : surface === 'mixed' ? t`Mixed` : t`Roads`;
    const placeLabel = start?.label ?? t`Start of the route`;
    // Once a route is on the map, the proposals shrink to their letters: the route comes first.
    const compactProposals = !!draft || drawing;
    const searchingFirst = generating && proposals.length === 0;

    const trailShare = (proposal: CourseDraft) => {
        const nature = proposal.line.nature;
        if (nature === undefined || surface === 'road') {
            return null;
        }
        const percent = Math.round(nature * 20) * 5;
        return t`${percent} % on trails`;
    };

    const hint = picking === 'start'
        ? t`Click the map where the route starts.`
        : picking === 'finish'
            ? t`Click the map where the route finishes.`
            : drawing
                ? (draft || start ? t`Click the map to add the next point.` : t`Click the map where the route starts.`)
                : draft
                    ? null
                    : proposals.length > 0
                        ? t`Pick a suggestion, on the map or in the list.`
                        : start ? null : t`Enter the address of the start, or click the map.`;

    const busyText = editor.routing
        ? t`Routing…`
        : generating ? (proposals.length > 0 ? t`More routes on the way…` : t`Looking for routes around the start…`) : null;

    const setupSteps = (
        <>
            <Step
                number={1}
                title={t({message: 'Start', context: 'course'})}
                done={!!start}
                action={!setupDone || !(searched || drawing || draft) ? null : (
                    <UnstyledButton className={classes.stepLink} onClick={() => setExpanded(false)}>
                        {t`Collapse`}
                    </UnstyledButton>
                )}
            >
                <SegmentedControl
                    fullWidth
                    className={classes.segmented}
                    data-rough
                    value={kind}
                    onChange={(value) => guard(() => {
                        setKind(value as CourseKind);
                        startOver();
                    })}
                    data={[
                        {value: 'loop', label: t`Loop`},
                        {value: 'line', label: t`Point to point`},
                    ]}
                />

                <PlaceInput
                    label={kind === 'loop' ? t`Start and finish` : t({message: 'Start', context: 'course'})}
                    placeholder={t`Address, park, trailhead…`}
                    value={start}
                    near={start?.position ?? eventPlace?.position}
                    picking={picking === 'start'}
                    onPick={() => setPicking(picking === 'start' ? null : 'start')}
                    onChange={(place) => changeEnd('start', place, true)}
                />

                {kind === 'line' && (
                    <PlaceInput
                        label={t`Finish (optional)`}
                        placeholder={t`Leave empty: Dehors suggests one`}
                        value={finish}
                        near={start?.position ?? eventPlace?.position}
                        picking={picking === 'finish'}
                        onPick={() => setPicking(picking === 'finish' ? null : 'finish')}
                        onChange={(place) => changeEnd('finish', place)}
                    />
                )}

                {!eventPlace && !editing && !start && (
                    <Link className={classes.tipLink} to={`${eventSettingsTabPath(eventId!, 'event')}#location-settings`}>
                        <IconMapPin size={16}/>
                        {t`Add the event's location: the start will be placed there`}
                    </Link>
                )}
            </Step>

            <Step number={2} title={t`Distance and terrain`} done={!!start && targetM > 0}>
                <div className={classes.distanceRow}>
                    <NumberInput
                        className={classes.distanceInput}
                        aria-label={t`Distance`}
                        suffix=" km"
                        decimalScale={1}
                        decimalSeparator={decimalSeparator()}
                        allowedDecimalSeparators={['.', ',']}
                        // While typing « 6, » the value is the string « 6. »: read it as a number, not as text.
                        valueIsNumericString
                        hideControls
                        min={0.5}
                        max={200}
                        value={targetKm}
                        onChange={setTargetKm}
                    />
                    <div className={classes.quickDistances}>
                        {QUICK_DISTANCES.map((km) => (
                            <UnstyledButton
                                key={km}
                                className={classes.chip}
                                data-rough="button"
                                data-active={askedKm === km || undefined}
                                aria-pressed={askedKm === km}
                                onClick={() => setTargetKm(km)}
                            >
                                {kmText(km)}
                            </UnstyledButton>
                        ))}
                    </div>
                </div>

                <div>
                    <p className={classes.fieldLabel}>{t`Mostly on`}</p>
                    <SegmentedControl
                        fullWidth
                        className={classes.segmented}
                        data-rough
                        value={surface}
                        onChange={(value) => setSurface(value as CourseSurface)}
                        data={[
                            {value: 'trail', label: t`Trails`},
                            {value: 'mixed', label: t`Mixed`},
                            {value: 'road', label: t`Roads`},
                        ]}
                    />
                </div>
            </Step>
        </>
    );

    // The first search is the main action; after that it steps back behind the proposals and the route.
    const searchFirst = !draft && proposals.length === 0 && !drawing;
    const searchButton = (
        <Button
            key={searchFirst ? 'search-first' : 'search-again'}
            className={searchFirst ? classes.primaryButton : classes.outlineButton}
            variant={searchFirst ? undefined : 'default'}
            leftSection={searchingFirst ? <Loader size={16}/> : <IconSparkles size={searchFirst ? 18 : 16}/>}
            disabled={!start || targetM <= 0 || searchingFirst}
            onClick={propose}
        >
            {searchingFirst
                ? t`Searching…`
                : !searchFirst ? t({message: 'Suggest', context: 'course'}) : searched ? t`Suggest again` : t`Suggest routes`}
        </Button>
    );

    return (
        // The shadow sits on a plain wrapper: the cut edge of the card would clip its own.
        <div className={classes.makerShadow}>
        <section className={classes.maker} data-rough>
            <div className={classes.panel}>
                <div className={classes.panelBody}>
                    {editing && (
                        <div className={classes.editingHead} data-rough>
                            <span className={classes.editingTag} data-rough><IconPencil size={14}/>{t`Editing`}</span>
                            <strong className={classes.editingName}>{editing.routeFile.label}</strong>
                            <Button variant="subtle" size="compact-sm" className={classes.linkButton}
                                    onClick={() => guard(() => onDone())}>
                                {t`Cancel`}
                            </Button>
                        </div>
                    )}

                    {justSaved && (
                        <div className={classes.savedBanner} data-rough role="status">
                            <IconCircleCheck size={20}/>
                            <p>{t`« ${justSaved} » is saved. Draw another one from the same start, or find it below.`}</p>
                            <button type="button" className={classes.legendClose} data-rough="button" aria-label={t`Close`}
                                    onClick={() => setJustSaved(null)}>
                                <IconX size={14}/>
                            </button>
                        </div>
                    )}

                    {collapsed ? (
                        <UnstyledButton className={classes.summary} data-rough="button" onClick={() => setExpanded(true)}>
                            <span className={classes.stepNumber} data-rough data-done aria-hidden><IconCheck size={14} stroke={3}/></span>
                            <span className={classes.summaryText}>
                                <strong>{[kindLabel, formatKm(targetM), surfaceLabel].join(" · ")}</strong>
                                <span>{kind === 'line' && finish ? `${placeLabel} → ${finish.label}` : placeLabel}</span>
                            </span>
                            <span className={classes.stepLink}>{t({message: 'Change', context: 'course settings'})}</span>
                        </UnstyledButton>
                    ) : setupSteps}

                    <Step number={3} title={t`Choose the route`} done={!!draft}>
                        <div className={classes.actions} data-compact={!searchFirst || undefined}>
                            {searchButton}
                            <Button
                                variant="default"
                                className={classes.outlineButton}
                                leftSection={<IconPencil size={searchFirst ? 18 : 16}/>}
                                data-active={drawing || undefined}
                                aria-pressed={drawing}
                                onClick={() => drawing ? setDrawing(false) : startDrawing()}
                            >
                                {t`Draw it myself`}
                            </Button>
                        </div>

                        {!start && !draft && !drawing && (
                            <p className={classes.helper}>{t`Choose a start first (step 1), or draw the route yourself.`}</p>
                        )}

                        {drawing && (
                            <div className={classes.drawingCard} data-rough>
                                <IconClick size={20} className={classes.drawingIcon}/>
                                <p>
                                    {t`Click the map, point by point: the route follows the trails and streets.`}
                                    {kind === 'loop' && ` ${t`The loop comes back to the start by itself.`}`}
                                </p>
                                <div className={classes.drawingActions}>
                                    <Button variant="default" className={classes.smallOutlineButton}
                                            leftSection={<IconArrowBackUp size={16}/>} disabled={!editor.canUndo}
                                            onClick={editor.undo}>
                                        {t`Undo`}
                                    </Button>
                                    <Button className={classes.inkButton} onClick={() => setDrawing(false)}>
                                        {draft ? t`Stop drawing` : t`Cancel`}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {generating && (
                            <p className={classes.searching} aria-live="polite">
                                <Loader size={14}/>
                                <span className={classes.searchingText}>
                                    {proposals.length > 0
                                        ? t`More routes on the way…`
                                        : slow ? t`Still a few seconds…` : t`Looking for routes around the start…`}
                                </span>
                                <UnstyledButton className={classes.stepLink} onClick={() => stopSearch(proposals.length > 0)}>
                                    {t({message: 'Stop', context: 'course search'})}
                                </UnstyledButton>
                            </p>
                        )}

                        {proposals.length > 0 && compactProposals && (
                            <div className={classes.proposalChips}>
                                <span className={classes.fieldLabel}>{t`Proposals`}</span>
                                {proposals.map((proposal, index) => {
                                    const letter = proposalLetter(index);
                                    const distance = formatKm(proposal.line.distance);
                                    return (
                                    <UnstyledButton
                                        key={index}
                                        className={classes.proposalChip}
                                        data-rough="button"
                                        style={{'--proposal-color': colorOf(index)} as CSSProperties}
                                        data-selected={(!!draft && !drawing && selected === index) || undefined}
                                        data-hovered={hovered === index || undefined}
                                        aria-pressed={!!draft && !drawing && selected === index}
                                        aria-label={t`Proposal ${letter}, ${distance}`}
                                        onClick={() => selectProposal(index)}
                                        onMouseEnter={() => setHovered(index)}
                                        onMouseLeave={() => setHovered(null)}
                                        onFocus={() => setHovered(index)}
                                        onBlur={() => setHovered(null)}
                                    >
                                        <span className={classes.chipLetter} data-rough>{letter}</span>
                                        {distance}
                                    </UnstyledButton>
                                    );
                                })}
                            </div>
                        )}

                        {!compactProposals && (proposals.length > 0 || generating) && (
                            <div className={classes.proposals}>
                                {proposals.map((proposal, index) => {
                                    const climb = formatClimb(proposal.line.ascent);
                                    const share = trailShare(proposal);
                                    const proposalGap = proposal.line.distance - targetM;
                                    return (
                                        <UnstyledButton
                                            key={index}
                                            className={classes.proposal}
                                            data-rough="button"
                                            style={{'--proposal-color': colorOf(index)} as CSSProperties}
                                            data-hovered={hovered === index || undefined}
                                            onClick={() => selectProposal(index)}
                                            onMouseEnter={() => setHovered(index)}
                                            onMouseLeave={() => setHovered(null)}
                                            onFocus={() => setHovered(index)}
                                            onBlur={() => setHovered(null)}
                                        >
                                            <span className={classes.proposalThumb}>
                                                <span className={classes.proposalShape} data-rough>
                                                    <CourseShape points={proposal.line.points} color={colorOf(index)} size={44}/>
                                                </span>
                                                <span className={classes.proposalLetter} data-rough>{proposalLetter(index)}</span>
                                            </span>
                                            <span className={classes.proposalText}>
                                                <strong>{formatKm(proposal.line.distance)}</strong>
                                                <span>{t`${climb} of climb`}</span>
                                                {share && <span>{share}</span>}
                                            </span>
                                            {targetM > 0 && (
                                                <span className={classes.gap} data-rough
                                                      data-close={Math.abs(proposalGap) / targetM <= 0.05 || undefined}>
                                                    {gapText(proposalGap)}
                                                </span>
                                            )}
                                        </UnstyledButton>
                                    );
                                })}
                                {generating && Array.from({length: proposals.length === 0 ? 3 : 1}, (_, index) => (
                                    <Skeleton key={`waiting-${index}`} height={68} radius={16} className={classes.proposalSkeleton}/>
                                ))}
                            </div>
                        )}

                        {searchFailed && !generating && proposals.length === 0 && !draft && !drawing && (
                            <div className={classes.notice} data-rough role="alert">
                                <p>{t`The search could not reach the map server. Check your connection and try again.`}</p>
                                <Button variant="subtle" size="compact-sm" className={classes.linkButton} onClick={propose}>
                                    {t`Try again`}
                                </Button>
                            </div>
                        )}

                        {searched && !searchFailed && !generating && proposals.length === 0 && !draft && !drawing && (
                            <p className={classes.notice} data-rough role="status">
                                {t`No route found from this start. Move the start a little, change the distance, or draw it yourself.`}
                            </p>
                        )}

                        {full && !editing && (
                            <p className={classes.notice} data-rough>{t`This event already has 5 routes: delete one to add this one.`}</p>
                        )}
                    </Step>

                    {draft && (
                        <div className={classes.result}>
                            <div className={classes.resultHead}>
                                <span className={classes.resultBadge} style={{background: color}}>
                                    {selected !== null && !drawing && draft === pristine.current
                                        ? proposalLetter(selected)
                                        : <IconPencil size={16}/>}
                                </span>
                                <div className={classes.resultFigures}>
                                    <strong>{formatKm(draft.line.distance)}</strong>
                                    <span className={classes.resultClimb}>{t`${draftClimb} of climb`}</span>
                                    {targetM > 0 && (
                                        <span className={classes.gap} data-rough data-close={gapClose || undefined}>
                                            {gapText(gap)}
                                        </span>
                                    )}
                                </div>
                                {!drawing && editor.canUndo && (
                                    <Button variant="subtle" size="compact-sm" className={classes.linkButton}
                                            leftSection={<IconArrowBackUp size={16}/>} onClick={editor.undo}>
                                        {t`Undo`}
                                    </Button>
                                )}
                            </div>
                            <ElevationProfile points={draft.line.points} distance={draft.line.distance}/>
                            <TextInput
                                className={classes.nameInput}
                                label={t`Name`}
                                description={t`Shown on the ticket and the event page.`}
                                value={name}
                                maxLength={100}
                                onChange={(event) => {
                                    setNameTouched(true);
                                    setName(event.currentTarget.value);
                                }}
                            />
                        </div>
                    )}
                </div>

                {draft && (
                    <div className={classes.footer} data-rough>
                        <p className={classes.footerNote}>
                            <span className={classes.footerDot} data-quiet={(!!editing && !unsaved) || undefined} aria-hidden/>
                            {editing ? (unsaved ? t`Changes not saved` : t`No changes yet`) : t`Not added to the event yet`}
                        </p>
                        <div className={classes.actions}>
                            <Button className={classes.primaryButton} loading={saving}
                                    disabled={!name.trim() || editor.routing || (full && !editing) || (!!editing && !unsaved)}
                                    onClick={save}>
                                {editing ? t`Save changes` : t`Add to the event`}
                            </Button>
                            <Button variant="default" className={classes.gpxButton} aria-label={t`Download the GPX`}
                                    title={t`Download the GPX`} onClick={() => downloadGpx(name.trim(), gpxText())}>
                                <IconDownload size={18}/>
                                <span className={classes.gpxLabel}>{t`GPX`}</span>
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className={classes.mapFrame}>
                <div ref={container} className={classes.map}/>
                {hint && <p className={classes.hint} data-rough aria-live="polite">{hint}</p>}
                {draft && !drawing && (legendHidden ? (
                    <button type="button" className={classes.legendToggle} data-rough="button" aria-label={t`How to edit the route`}
                            title={t`How to edit the route`} onClick={() => hideLegend(false)}>
                        <IconHelp size={20}/>
                    </button>
                ) : (
                    <div className={classes.legend} data-rough>
                        <ul>
                            <li><IconHandGrab size={16}/>{t`Drag a point to move it`}</li>
                            <li><IconPlus size={16}/>{t`Click the line to add a point`}</li>
                            <li><IconX size={16}/>{t`Click a point to remove it`}</li>
                        </ul>
                        <button type="button" className={classes.legendClose} data-rough="button" aria-label={t`Hide the help`}
                                onClick={() => hideLegend(true)}>
                            <IconX size={14}/>
                        </button>
                    </div>
                ))}
                {busyText && (
                    <span className={classes.busy} data-rough aria-live="polite"><Loader size={14}/>{busyText}</span>
                )}
                {failedShown && (
                    <p className={classes.error} data-rough role="alert">{t`No trail or street goes there. The route was kept as it was.`}</p>
                )}
                {mapFailed && <p className={classes.error} data-rough role="alert">{t`The map could not load. Please reload the page.`}</p>}
                {!map && !mapFailed && <div className={classes.mapLoading}><Loader size={24}/></div>}
            </div>
        </section>
        </div>
    );
};

// The editor, started on the course being edited.
const useCourseEditorFor = (kind: CourseKind, surface: CourseSurface, initialDraft: CourseDraft | null) => {
    const editor = useCourseEditor(kind, surface);
    const loaded = useRef(false);
    const {load} = editor;
    useEffect(() => {
        if (!loaded.current && initialDraft) {
            loaded.current = true;
            load(initialDraft);
        }
    }, [load, initialDraft]);

    return editor;
};
