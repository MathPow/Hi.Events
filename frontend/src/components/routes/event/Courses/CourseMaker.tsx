import {ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Link, useBlocker} from "react-router";
import {t} from "@lingui/macro";
import {Button, Loader, NumberInput, SegmentedControl, Skeleton, Text, TextInput, UnstyledButton} from "@mantine/core";
import {modals} from "@mantine/modals";
import {
    IconArrowBackUp,
    IconCheck,
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

interface CourseMakerProps {
    eventId: IdParam;
    eventPlace?: Place;
    editing: CourseToEdit | null;
    full: boolean;
    onDone: (savedId?: number) => void;
    onDirtyChange?: (dirty: boolean) => void;
}

const QUICK_DISTANCES = [5, 6.7, 10, 21.1, 42.2];
// Within 50 m of the distance asked for: « Pile la distance » rather than « +0,0 km ».
const ON_TARGET_M = 50;
// Past this, a search tells the organizer it is still going.
const SLOW_SEARCH_MS = 4000;
const LEGEND_KEY = 'dehors-course-legend-hidden';

type Picking = 'start' | 'finish' | null;

const colorOf = (index: number | null) => PROPOSAL_COLORS[(index ?? 0) % PROPOSAL_COLORS.length];

const kmText = (km: number) => new Intl.NumberFormat(intlLocale(), {maximumFractionDigits: 1}).format(km);

// « 6,7 » in French, « 6.7 » in English: the field shows the page's separator and takes either one.
const decimalSeparator = () =>
    new Intl.NumberFormat(intlLocale()).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';

const gapText = (metres: number) => Math.abs(metres) < ON_TARGET_M ? t`Right on the distance` : formatGap(metres);

const readLegendHidden = () => {
    try {
        return window.localStorage.getItem(LEGEND_KEY) === '1';
    } catch {
        return false;
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
            <span className={classes.stepNumber} data-done={done || undefined} aria-hidden>
                {done ? <IconCheck size={14} stroke={3}/> : number}
            </span>
            <h3 className={classes.stepTitle}>{title}</h3>
            {action}
        </header>
        {children}
    </section>
);

export const CourseMaker = ({eventId, eventPlace, editing, full, onDone, onDirtyChange}: CourseMakerProps) => {
    const container = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<MapLibreMap | null>(null);
    const maplibre = useRef<typeof import('maplibre-gl') | null>(null);
    const [mapFailed, setMapFailed] = useState(false);

    const initial = useMemo(() => (editing ? draftFromGpx(editing.gpx) : null), [editing]);

    const [kind, setKind] = useState<CourseKind>(initial?.kind ?? 'loop');
    const [surface, setSurface] = useState<CourseSurface>(initial?.surface ?? 'trail');
    const [targetKm, setTargetKm] = useState<number | string>(
        initial?.targetM ? Math.round(initial.targetM / 100) / 10 : initial ? Math.round(initial.draft.line.distance / 100) / 10 : 5,
    );
    const [start, setStart] = useState<Place | null>(
        initial ? {label: t`Start of the route`, position: initial.draft.waypoints[0]} : eventPlace ?? null,
    );
    const [finish, setFinish] = useState<Place | null>(
        initial?.kind === 'line'
            ? {label: t`Finish of the route`, position: initial.draft.waypoints[initial.draft.waypoints.length - 1]}
            : null,
    );
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
    const color = colorOf(selected);
    // Left at « 6, » the field holds the text « 6. »: still 6 km.
    const askedKm = typeof targetKm === 'number' ? targetKm : parseFloat(targetKm);
    const targetM = Number.isFinite(askedKm) && askedKm > 0 ? askedKm * 1000 : 0;

    // The course as it came (a proposal, the saved file): anything else is work that a new search would lose.
    const pristine = useRef<CourseDraft | null>(initial?.draft ?? null);
    const dirty = !!draft && draft !== pristine.current;

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
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    // ---- leaving with a course not saved ----

    const blocker = useBlocker(({currentLocation, nextLocation}) =>
        dirty && !saving && currentLocation.pathname !== nextLocation.pathname);

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
        if (!dirty) {
            return;
        }
        const warn = (beforeUnload: BeforeUnloadEvent) => beforeUnload.preventDefault();
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    // ---- the map ----

    useEffect(() => {
        const element = container.current;
        if (!element) {
            return;
        }
        let cancelled = false;
        let created: MapLibreMap | undefined;
        const center = initial?.draft.waypoints[0] ?? eventPlace?.position;

        loadCourseMap(element, center ? {center: [center.lng, center.lat], zoom: 14} : {})
            .then(({map: loaded, maplibregl}) => {
                if (cancelled) {
                    loaded.remove();
                    return;
                }
                created = loaded;
                maplibre.current = maplibregl;
                loaded.addControl(new maplibregl.NavigationControl({showCompass: false}), 'top-right');
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
            showProposals(map, proposals.map((proposal) => proposal.line.points), draft ? selected : null);
        }
    }, [map, proposals, selected, draft]);

    const hoveredBefore = useRef<number | null>(null);
    useEffect(() => {
        if (map) {
            hoverProposal(map, hovered, hoveredBefore.current);
            hoveredBefore.current = hovered;
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
    const state = useRef({draft, picking, drawing, start, kind, proposals, dirty});
    state.current = {draft, picking, drawing, start, kind, proposals, dirty};

    const guard = useCallback((action: () => void) => {
        if (!state.current.dirty) {
            action();
            return;
        }
        confirmationDialog(t`Replace the route in progress? Your changes will be lost.`, action,
            {confirm: t`Replace`, cancel: t`Keep it`});
    }, []);

    const placeStart = useCallback((position: LatLng) => {
        setStart({label: t`Point on the map`, position});
        setPicking(null);
    }, []);

    const selectProposal = useCallback((index: number) => {
        const proposal = state.current.proposals[index];
        if (!proposal || state.current.draft === proposal) {
            return;
        }
        guard(() => {
            pristine.current = proposal;
            setSelected(index);
            setDrawing(false);
            load(proposal);
        });
    }, [load, guard]);

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
                setFinish({label: t`Point on the map`, position});
                setPicking(null);
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
    }, [map, append, insertOnLine, placeStart, selectProposal]);

    // ---- markers: the start, the finish, and the points to drag ----

    const markers = useRef<Marker[]>([]);
    const popup = useRef<Popup | null>(null);
    useEffect(() => {
        const lib = maplibre.current;
        if (!map || !lib) {
            return;
        }
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
            }
            markers.current.push(marker);
            return marker;
        };

        // MapLibre places a marker with its own transform: the look goes on an element inside it.
        const flag = (text: string, tone: 'start' | 'finish') => {
            const element = document.createElement('div');
            element.className = classes.flagMarker;
            element.dataset.anchor = 'bottom';
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
                remove(index);
            });
            popup.current = new lib.Popup({closeButton: false, offset: 18, className: classes.popup, focusAfterOpen: true})
                .setLngLat([position.lng, position.lat])
                .setDOMContent(button)
                .addTo(map);
        };

        if (draft) {
            const last = draft.waypoints.length - 1;
            const canRemove = draft.waypoints.length > 2;
            draft.waypoints.forEach((point, index) => {
                if (index === 0) {
                    add(flag(kind === 'loop' ? t`Start and finish` : t({message: 'Start', context: 'course'}), 'start'), point, (p) => move(0, p));
                    return;
                }
                if (kind === 'line' && index === last) {
                    add(flag(t`Finish`, 'finish'), point, (p) => move(index, p));
                    return;
                }
                const element = document.createElement('button');
                element.type = 'button';
                element.className = classes.handle;
                element.style.setProperty('--handle-color', color);
                const dot = document.createElement('span');
                dot.className = classes.handleDot;
                element.appendChild(dot);
                element.title = t`Drag to move · click to remove`;
                element.setAttribute('aria-label', t`Point ${index} of the route: drag it to move it, Delete key to remove it.`);
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
            if (start) {
                add(flag(kind === 'loop' ? t`Start and finish` : t({message: 'Start', context: 'course'}), 'start'), start.position, (p) => setStart({label: t`Point on the map`, position: p}));
            }
            if (kind === 'line' && finish) {
                add(flag(t`Finish`, 'finish'), finish.position, (p) => setFinish({label: t`Point on the map`, position: p}));
            }
        }
    }, [map, draft, start, finish, kind, color, move, remove]);

    useEffect(() => () => {
        markers.current.forEach((marker) => marker.remove());
        popup.current?.remove();
    }, []);

    // The map follows a newly chosen address.
    useEffect(() => {
        if (map && start && !state.current.draft) {
            map.flyTo({center: [start.position.lng, start.position.lat], zoom: Math.max(map.getZoom(), 14), duration: 700});
        }
    }, [map, start]);

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
        setExpanded(false);
        setDrawing(false);
        setSelected(null);
        setHovered(null);
        setProposals([]);
        pristine.current = null;
        load(null);

        // The map shows the first proposals as soon as they come, then all of them at the end.
        let shown = false;
        const onUpdate = (found: CourseDraft[]) => {
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
            }
        } catch {
            // replaced by a newer search
        } finally {
            if (generation.current === controller) {
                setGenerating(false);
            }
        }
    };

    const propose = () => guard(() => void runSearch());

    const stopSearch = () => {
        generation.current?.abort();
        generation.current = null;
        setGenerating(false);
        if (proposals.length === 0) {
            setSearched(false);
        }
    };

    useEffect(() => () => generation.current?.abort(), []);

    const startDrawing = () => guard(() => {
        generation.current?.abort();
        setGenerating(false);
        setProposals([]);
        setSearched(false);
        setSelected(null);
        setExpanded(false);
        pristine.current = null;
        load(null);
        setDrawing(true);
    });

    const startOver = () => {
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
        try {
            if (editing) {
                await replaceMutation.mutateAsync({eventId, routeFileId: editing.routeFile.id, file, label});
                pristine.current = draft;
                showSuccess(t`Route saved. Participants download the new version.`);
                onDone(editing.routeFile.id);
            } else {
                const response = await uploadMutation.mutateAsync({eventId, file, label});
                pristine.current = draft;
                showSuccess(t`Route added. Participants can download it from their ticket.`);
                onDone(response?.data?.id);
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
    const setupDone = !!start && targetM > 0;
    const collapsed = setupDone && (searched || drawing || !!draft) && !expanded;
    const kindLabel = kind === 'loop' ? t`Loop` : t`Point to point`;
    const surfaceLabel = surface === 'trail' ? t`Trails` : surface === 'mixed' ? t`Mixed` : t`Roads`;

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

    const setup = (
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
                    onChange={setStart}
                />

                {kind === 'line' && (
                    <PlaceInput
                        label={t`Finish (optional)`}
                        placeholder={t`Leave empty: Dehors suggests one`}
                        value={finish}
                        near={start?.position ?? eventPlace?.position}
                        picking={picking === 'finish'}
                        onPick={() => setPicking(picking === 'finish' ? null : 'finish')}
                        onChange={setFinish}
                    />
                )}

                {!eventPlace && !editing && (
                    <Link className={classes.tipLink} to={`${eventSettingsTabPath(eventId!, 'event')}#location-settings`}>
                        <IconMapPin size={16}/>
                        {t`Add the event's location: the start will be placed there`}
                    </Link>
                )}
            </Step>

            <Step number={2} title={t`Distance and terrain`} done={targetM > 0}>
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

    return (
        <section className={classes.maker}>
            <div className={classes.panel}>
                <div className={classes.panelBody}>
                    {editing && (
                        <div className={classes.editingHead}>
                            <span className={classes.editingTag}><IconPencil size={14}/>{t`Editing`}</span>
                            <strong className={classes.editingName}>{editing.routeFile.label}</strong>
                            <Button variant="subtle" size="compact-sm" className={classes.linkButton}
                                    onClick={() => guard(() => onDone())}>
                                {t`Cancel`}
                            </Button>
                        </div>
                    )}

                    {collapsed && start ? (
                        <UnstyledButton className={classes.summary} onClick={() => setExpanded(true)}>
                            <span className={classes.stepNumber} data-done aria-hidden><IconCheck size={14} stroke={3}/></span>
                            <span className={classes.summaryText}>
                                <strong>{[kindLabel, formatKm(targetM), surfaceLabel].join(" · ")}</strong>
                                <span>{kind === 'line' && finish ? `${start.label} → ${finish.label}` : start.label}</span>
                            </span>
                            <span className={classes.stepLink}>{t({message: 'Change', context: 'course settings'})}</span>
                        </UnstyledButton>
                    ) : setup}

                    <Step number={3} title={t`Choose the route`} done={!!draft}>
                        <div className={classes.actions}>
                            <Button
                                className={draft ? classes.outlineButton : classes.primaryButton}
                                variant={draft ? 'default' : undefined}
                                leftSection={<IconSparkles size={18}/>}
                                disabled={!start || targetM <= 0}
                                onClick={propose}
                            >
                                {searched || draft ? t`Suggest again` : t`Suggest routes`}
                            </Button>
                            <Button
                                variant="default"
                                className={classes.outlineButton}
                                leftSection={<IconPencil size={18}/>}
                                data-active={drawing || undefined}
                                aria-pressed={drawing}
                                onClick={() => drawing ? setDrawing(false) : startDrawing()}
                            >
                                {t`Draw it myself`}
                            </Button>
                        </div>

                        {!start && !drawing && (
                            <p className={classes.helper}>{t`Choose a start first (step 1), or draw the route yourself.`}</p>
                        )}

                        {drawing && (
                            <div className={classes.drawingCard}>
                                <IconClick size={20} className={classes.drawingIcon}/>
                                <p>
                                    {t`Click the map, point by point: the route follows the trails and streets.`}
                                    {kind === 'loop' && ` ${t`The loop comes back to the start by itself.`}`}
                                </p>
                                <div className={classes.drawingActions}>
                                    <Button variant="subtle" size="compact-sm" className={classes.linkButton}
                                            leftSection={<IconArrowBackUp size={16}/>} disabled={!editor.canUndo}
                                            onClick={editor.undo}>
                                        {t`Undo`}
                                    </Button>
                                    <Button size="compact-sm" className={classes.inkButton} onClick={() => setDrawing(false)}>
                                        {draft ? t`Stop drawing` : t`Cancel`}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {(proposals.length > 0 || generating) && (
                            <div className={classes.proposals}>
                                {proposals.map((proposal, index) => {
                                    const climb = formatClimb(proposal.line.ascent);
                                    const share = trailShare(proposal);
                                    const proposalGap = proposal.line.distance - targetM;
                                    return (
                                        <UnstyledButton
                                            key={index}
                                            className={classes.proposal}
                                            data-selected={(!!draft && selected === index) || undefined}
                                            data-hovered={hovered === index || undefined}
                                            aria-pressed={!!draft && selected === index}
                                            onClick={() => selectProposal(index)}
                                            onMouseEnter={() => setHovered(index)}
                                            onMouseLeave={() => setHovered(null)}
                                            onFocus={() => setHovered(index)}
                                            onBlur={() => setHovered(null)}
                                        >
                                            <span className={classes.proposalThumb}>
                                                <CourseShape points={proposal.line.points} color={colorOf(index)} size={44}/>
                                                <span className={classes.proposalLetter} style={{background: colorOf(index)}}>
                                                    {proposalLetter(index)}
                                                </span>
                                            </span>
                                            <span className={classes.proposalText}>
                                                <strong>{formatKm(proposal.line.distance)}</strong>
                                                <span>{share ? `${t`${climb} of climb`} · ${share}` : t`${climb} of climb`}</span>
                                            </span>
                                            {targetM > 0 && (
                                                <span className={classes.gap}
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
                                {generating && (
                                    <p className={classes.searching} aria-live="polite">
                                        <Loader size={14}/>
                                        <span>
                                            {proposals.length > 0
                                                ? t`More routes on the way…`
                                                : slow ? t`Still a few seconds…` : t`Looking for routes around the start…`}
                                        </span>
                                        <UnstyledButton className={classes.stepLink} onClick={stopSearch}>
                                            {t({message: 'Stop', context: 'course search'})}
                                        </UnstyledButton>
                                    </p>
                                )}
                            </div>
                        )}

                        {searched && !generating && proposals.length === 0 && !draft && !drawing && (
                            <p className={classes.notice} role="status">
                                {t`No route found from this start. Move the start a little, change the distance, or draw it yourself.`}
                            </p>
                        )}

                        {full && !editing && (
                            <p className={classes.notice}>{t`This event already has 5 routes: delete one to add this one.`}</p>
                        )}
                    </Step>

                    {draft && (
                        <div className={classes.result}>
                            <div className={classes.resultHead}>
                                <span className={classes.resultBadge} style={{background: color}}>
                                    {selected !== null && !drawing && !dirty ? proposalLetter(selected) : <IconPencil size={16}/>}
                                </span>
                                <div className={classes.resultFigures}>
                                    <strong>{formatKm(draft.line.distance)}</strong>
                                    <span>{t`${draftClimb} of climb`}</span>
                                </div>
                                {targetM > 0 && (
                                    <span className={classes.gap} data-close={gapClose || undefined}>
                                        {gapText(gap)}
                                    </span>
                                )}
                                {!drawing && (
                                    <Button variant="subtle" size="compact-sm" className={classes.linkButton}
                                            leftSection={<IconArrowBackUp size={16}/>} disabled={!editor.canUndo}
                                            onClick={editor.undo}>
                                        {t`Undo`}
                                    </Button>
                                )}
                            </div>
                            <ElevationProfile points={draft.line.points}/>
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
                    <div className={classes.footer}>
                        <p className={classes.footerNote}>
                            <span className={classes.footerDot} aria-hidden/>
                            {editing ? (dirty ? t`Changes not saved` : t`No changes yet`) : t`Not added to the event yet`}
                        </p>
                        <div className={classes.actions}>
                            <Button className={classes.primaryButton} loading={saving}
                                    disabled={!name.trim() || editor.routing || (full && !editing) || (!!editing && !dirty && name.trim() === editing.routeFile.label)}
                                    onClick={save}>
                                {editing ? t`Save changes` : t`Add to the event`}
                            </Button>
                            <Button variant="default" className={classes.outlineButton} leftSection={<IconDownload size={18}/>}
                                    onClick={() => downloadGpx(name.trim(), gpxText())}>
                                {t`GPX`}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <div className={classes.mapFrame}>
                <div ref={container} className={classes.map}/>
                {hint && <p className={classes.hint} aria-live="polite">{hint}</p>}
                {draft && !drawing && (legendHidden ? (
                    <button type="button" className={classes.legendToggle} aria-label={t`How to edit the route`}
                            title={t`How to edit the route`} onClick={() => hideLegend(false)}>
                        <IconHelp size={20}/>
                    </button>
                ) : (
                    <div className={classes.legend}>
                        <ul>
                            <li><IconHandGrab size={16}/>{t`Drag a point to move it`}</li>
                            <li><IconPlus size={16}/>{t`Click the line to add a point`}</li>
                            <li><IconX size={16}/>{t`Click a point to remove it`}</li>
                        </ul>
                        <button type="button" className={classes.legendClose} aria-label={t`Hide the help`}
                                onClick={() => hideLegend(true)}>
                            <IconX size={14}/>
                        </button>
                    </div>
                ))}
                {busyText && (
                    <span className={classes.busy} aria-live="polite"><Loader size={14}/>{busyText}</span>
                )}
                {failedShown && (
                    <p className={classes.error} role="alert">{t`No trail or street goes there. The route was kept as it was.`}</p>
                )}
                {mapFailed && <p className={classes.error} role="alert">{t`The map could not load. Please reload the page.`}</p>}
                {!map && !mapFailed && <div className={classes.mapLoading}><Loader size={24}/></div>}
            </div>
        </section>
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
