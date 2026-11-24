import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Button, Loader, NumberInput, SegmentedControl, TextInput, UnstyledButton} from "@mantine/core";
import {IconArrowBackUp, IconDownload, IconPencil, IconRoute, IconSparkles} from "@tabler/icons-react";
import type {Map as MapLibreMap, MapMouseEvent, Marker} from "maplibre-gl";
import {IdParam} from "../../../../types.ts";
import {boundsOf, elevationGain, haversine, LatLng, pathDistance, simplify} from "../../../../utilites/course/geo.ts";
import {buildGpx, CourseKind, downloadGpx, gpxFileName, ParsedGpx} from "../../../../utilites/course/gpx.ts";
import {CourseSurface} from "../../../../utilites/course/routing.ts";
import {CourseDraft, proposeCourses} from "../../../../utilites/course/proposals.ts";
import {EventRouteFile} from "../../../../api/eventRouteFile.client.ts";
import {useReplaceEventRouteFile, useUploadEventRouteFile} from "../../../../mutations/useEventRouteFileMutations.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {COURSE_LAYER, loadCourseMap, PROPOSAL_COLORS, PROPOSALS_LAYER, showCourse, showProposals} from "../../../common/CourseMap/courseLayers.ts";
import {ElevationProfile} from "../../../common/CourseMap/ElevationProfile.tsx";
import {formatClimb, formatGap, formatKm} from "../../../common/CourseMap/courseFormat.ts";
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
    onDone: () => void;
}

const QUICK_DISTANCES = [5, 6.7, 10, 21.1, 42.2];

type Picking = 'start' | 'finish' | null;

const colorOf = (index: number | null) => PROPOSAL_COLORS[(index ?? 0) % PROPOSAL_COLORS.length];

const kmText = (km: number) => new Intl.NumberFormat(intlLocale(), {maximumFractionDigits: 1}).format(km);

// « 6,7 » in French, « 6.7 » in English: the field shows the page's separator and takes either one.
const decimalSeparator = () =>
    new Intl.NumberFormat(intlLocale()).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.';

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

export const CourseMaker = ({eventId, eventPlace, editing, full, onDone}: CourseMakerProps) => {
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
    const [searched, setSearched] = useState(false);
    const [selected, setSelected] = useState<number | null>(null);
    const [name, setName] = useState(editing?.routeFile.label ?? '');
    const [nameTouched, setNameTouched] = useState(!!editing);
    const generation = useRef<AbortController | null>(null);

    const editor = useCourseEditorFor(kind, surface, initial?.draft ?? null);
    const {draft, load, move, remove, insertOnLine, append, rerouteAll} = editor;
    const color = colorOf(selected);
    const targetM = typeof targetKm === 'number' && targetKm > 0 ? targetKm * 1000 : 0;

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

    useEffect(() => {
        if (map) {
            showCourse(map, draft?.line.points ?? [], color);
        }
    }, [map, draft, color]);

    // The latest state, for the map's own event handlers.
    const state = useRef({draft, picking, drawing, start, kind, proposals});
    state.current = {draft, picking, drawing, start, kind, proposals};

    const placeStart = useCallback((position: LatLng) => {
        setStart({label: t`Point on the map`, position});
        setPicking(null);
    }, []);

    const selectProposal = useCallback((index: number) => {
        const proposal = state.current.proposals[index];
        if (!proposal) {
            return;
        }
        setSelected(index);
        setDrawing(false);
        load(proposal);
    }, [load]);

    useEffect(() => {
        if (!map) {
            return;
        }

        const hit = (event: MapMouseEvent, layer: string) => map.getLayer(layer)
            ? map.queryRenderedFeatures([[event.point.x - 6, event.point.y - 6], [event.point.x + 6, event.point.y + 6]], {layers: [layer]})
            : [];

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
            if (current.draft && hit(event, COURSE_LAYER).length > 0) {
                insertOnLine(position);
                return;
            }
            const proposal = hit(event, PROPOSALS_LAYER)[0];
            if (proposal) {
                selectProposal(Number(proposal.properties?.index));
                return;
            }
            if (!current.start && !current.draft) {
                placeStart(position);
            }
        };

        const onMove = (event: MapMouseEvent) => {
            const over = hit(event, COURSE_LAYER).length > 0 || hit(event, PROPOSALS_LAYER).length > 0;
            const current = state.current;
            map.getCanvas().style.cursor = current.picking || current.drawing ? 'crosshair' : over ? 'pointer' : '';
        };

        map.on('click', onClick);
        map.on('mousemove', onMove);
        return () => {
            map.off('click', onClick);
            map.off('mousemove', onMove);
        };
    }, [map, append, insertOnLine, placeStart, selectProposal]);

    // ---- markers: the start, the finish, and the points to drag ----

    const markers = useRef<Marker[]>([]);
    useEffect(() => {
        const lib = maplibre.current;
        if (!map || !lib) {
            return;
        }
        markers.current.forEach((marker) => marker.remove());
        markers.current = [];

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

        if (draft) {
            const last = draft.waypoints.length - 1;
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
                element.title = t`Drag to move · double-click to remove`;
                element.addEventListener('dblclick', (event) => {
                    event.stopPropagation();
                    remove(index);
                });
                add(element, point, (p) => move(index, p));
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

    useEffect(() => () => markers.current.forEach((marker) => marker.remove()), []);

    // The map follows a newly chosen address.
    useEffect(() => {
        if (map && start && !state.current.draft) {
            map.flyTo({center: [start.position.lng, start.position.lat], zoom: Math.max(map.getZoom(), 14), duration: 700});
        }
    }, [map, start]);

    // ---- proposals ----

    const propose = async () => {
        if (!start || targetM <= 0) {
            return;
        }
        generation.current?.abort();
        const controller = new AbortController();
        generation.current = controller;

        setGenerating(true);
        setSearched(true);
        setDrawing(false);
        setSelected(null);
        setProposals([]);
        load(null);

        try {
            const result = await proposeCourses(
                {kind, start: start.position, finish: kind === 'line' ? finish?.position : undefined, targetM, surface},
                setProposals,
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

    useEffect(() => () => generation.current?.abort(), []);

    const startDrawing = () => {
        generation.current?.abort();
        setGenerating(false);
        setProposals([]);
        setSelected(null);
        load(null);
        setDrawing(true);
    };

    const startOver = () => {
        generation.current?.abort();
        setGenerating(false);
        setProposals([]);
        setSearched(false);
        setSelected(null);
        setDrawing(false);
        setNameTouched(!!editing);
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
                showSuccess(t`Route saved. Participants download the new version.`);
            } else {
                await uploadMutation.mutateAsync({eventId, file, label});
                showSuccess(t`Route added. Participants can download it from their ticket.`);
            }
            onDone();
        } catch (error: any) {
            const messages = error?.response?.data?.errors?.file;
            showError(messages?.[0] ?? t`The route could not be saved. Please try again.`);
        }
    };

    // ---- the panel ----

    const gap = draft && targetM ? draft.line.distance - targetM : 0;
    const draftClimb = draft ? formatClimb(draft.line.ascent) : '';
    const gapClose = targetM > 0 && Math.abs(gap) / targetM <= 0.05;

    const hint = picking === 'start'
        ? t`Click the map where the route starts.`
        : picking === 'finish'
            ? t`Click the map where the route finishes.`
            : drawing
                ? (draft || start
                    ? t`Click the map to add the next point: the route follows the trails and streets.`
                    : t`Click the map where the route starts.`)
                : draft
                    ? t`Drag the points to change the route. Click the line to add a point, double-click a point to remove it.`
                    : proposals.length > 0
                        ? t`Pick a suggestion, on the map or in the list.`
                        : start ? null : t`Enter the address of the start, or click the map.`;

    return (
        <section className={classes.maker}>
            <div className={classes.panel}>
                <div className={classes.panelHead}>
                    <h2 className={classes.panelTitle}>{editing ? t`Edit the route` : t`Draw a route`}</h2>
                    {editing && (
                        <Button variant="subtle" size="compact-sm" className={classes.linkButton} onClick={onDone}>
                            {t`Cancel`}
                        </Button>
                    )}
                </div>

                <SegmentedControl
                    fullWidth
                    className={classes.segmented}
                    value={kind}
                    onChange={(value) => {
                        setKind(value as CourseKind);
                        startOver();
                    }}
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

                <div className={classes.distanceRow}>
                    <NumberInput
                        className={classes.distanceInput}
                        label={t`Distance`}
                        suffix=" km"
                        decimalScale={1}
                        decimalSeparator={decimalSeparator()}
                        allowedDecimalSeparators={['.', ',']}
                        // While typing « 6, » the value is the string « 6. »: read it as a number, not as text.
                        valueIsNumericString
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
                                data-active={targetKm === km || undefined}
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

                <div className={classes.actions}>
                    <Button
                        className={classes.primaryButton}
                        leftSection={<IconSparkles size={18}/>}
                        loading={generating && proposals.length === 0}
                        disabled={!start || targetM <= 0}
                        onClick={propose}
                    >
                        {proposals.length > 0 || draft ? t`Suggest again` : t`Suggest routes`}
                    </Button>
                    <Button
                        variant="default"
                        className={classes.outlineButton}
                        leftSection={<IconPencil size={18}/>}
                        data-active={drawing || undefined}
                        onClick={startDrawing}
                    >
                        {t`Draw it myself`}
                    </Button>
                </div>

                {(proposals.length > 0 || generating) && (
                    <div className={classes.proposals}>
                        {proposals.map((proposal, index) => {
                            const climb = formatClimb(proposal.line.ascent);
                            return (
                                <UnstyledButton
                                    key={index}
                                    className={classes.proposal}
                                    data-selected={selected === index || undefined}
                                    onClick={() => selectProposal(index)}
                                >
                                    <span className={classes.swatch} style={{background: colorOf(index)}}/>
                                    <span className={classes.proposalText}>
                                        <strong>{formatKm(proposal.line.distance)}</strong>
                                        <span>{t`${climb} of climb`}</span>
                                    </span>
                                    <span className={classes.proposalGap}>{formatGap(proposal.line.distance - targetM)}</span>
                                </UnstyledButton>
                            );
                        })}
                        {generating && (
                            <p className={classes.searching}>
                                <Loader size={14}/> {proposals.length > 0 ? t`Looking for more…` : t`Looking for routes on the trails and streets…`}
                            </p>
                        )}
                    </div>
                )}

                {searched && !generating && proposals.length === 0 && !draft && (
                    <p className={classes.notice}>
                        {t`No route found from this start. Move the start a little, change the distance, or draw it yourself.`}
                    </p>
                )}

                {draft && (
                    <div className={classes.result}>
                        <div className={classes.resultHead}>
                            <span className={classes.resultIcon} style={{background: color}}><IconRoute size={18}/></span>
                            <div className={classes.resultFigures}>
                                <strong>{formatKm(draft.line.distance)}</strong>
                                <span>{t`${draftClimb} of climb`}</span>
                            </div>
                            {targetM > 0 && (
                                <span className={classes.gap} data-close={gapClose || undefined}>
                                    {formatGap(gap)}
                                </span>
                            )}
                            <Button variant="subtle" size="compact-sm" className={classes.linkButton}
                                    leftSection={<IconArrowBackUp size={16}/>} disabled={!editor.canUndo} onClick={editor.undo}>
                                {t`Undo`}
                            </Button>
                        </div>
                        <ElevationProfile points={draft.line.points}/>
                        <TextInput
                            label={t`Name`}
                            description={t`Shown on the ticket and the event page.`}
                            value={name}
                            maxLength={100}
                            onChange={(event) => {
                                setNameTouched(true);
                                setName(event.currentTarget.value);
                            }}
                        />
                        <div className={classes.actions}>
                            <Button className={classes.primaryButton} loading={saving}
                                    disabled={!name.trim() || editor.routing || (full && !editing)} onClick={save}>
                                {editing ? t`Save changes` : t`Add to the event`}
                            </Button>
                            <Button variant="default" className={classes.outlineButton} leftSection={<IconDownload size={18}/>}
                                    onClick={() => downloadGpx(name.trim(), gpxText())}>
                                {t`GPX`}
                            </Button>
                        </div>
                        {full && !editing && (
                            <p className={classes.notice}>{t`This event already has 5 routes: delete one to add this one.`}</p>
                        )}
                    </div>
                )}
            </div>

            <div className={classes.mapFrame}>
                <div ref={container} className={classes.map}/>
                {hint && <p className={classes.hint}>{hint}</p>}
                {(editor.routing || (generating && proposals.length > 0)) && (
                    <span className={classes.busy}><Loader size={16}/></span>
                )}
                {editor.failed && (
                    <p className={classes.error}>{t`No trail or street goes there. The route was kept as it was.`}</p>
                )}
                {mapFailed && <p className={classes.error}>{t`The map could not load. Please reload the page.`}</p>}
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
