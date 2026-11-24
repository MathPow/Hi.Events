import {useCallback, useEffect, useRef, useState} from "react";
import {useParams} from "react-router";
import {t} from "@lingui/macro";
import {Skeleton} from "@mantine/core";
import {useQueryClient} from "@tanstack/react-query";
import {useGetEventSettings} from "../../../../queries/useGetEventSettings.ts";
import {useGetEventMapLocation} from "../../../../queries/useGetEventMapLocation.ts";
import {useGetEventRouteFiles} from "../../../../queries/useGetEventRouteFiles.ts";
import {eventRouteFileGpxQuery} from "../../../../queries/useGetEventRouteFileGpx.ts";
import {EventRouteFile, MAX_ROUTE_FILES_PER_EVENT} from "../../../../api/eventRouteFile.client.ts";
import {formatAddress} from "../../../../utilites/addressUtilities.ts";
import {showError} from "../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../utilites/confirmationDialog.tsx";
import {RouteFilesCard} from "../Settings/cards/RouteFilesCard.tsx";
import {CourseMaker, CourseSetup, CourseToEdit, PendingRoute, SavedCourse} from "./CourseMaker.tsx";
import {Place} from "./PlaceInput.tsx";
import classes from "./Courses.module.scss";

/**
 * « Parcours »: draw a loop or a point-to-point route on real trails and streets (Dehors suggests some
 * at the distance asked for), then give it to the participants as a GPX, on their ticket and the event page.
 */
const Courses = () => {
    const {eventId} = useParams();
    const queryClient = useQueryClient();
    const settingsQuery = useGetEventSettings(eventId);
    const locationQuery = useGetEventMapLocation(eventId, !!eventId);
    const routeFiles = useGetEventRouteFiles(eventId).data ?? [];
    const [editing, setEditing] = useState<CourseToEdit | null>(null);
    const [round, setRound] = useState(0);
    const [saved, setSaved] = useState<SavedCourse | null>(null);
    // The next route starts from the last one saved.
    const [setup, setSetup] = useState<CourseSetup | null>(null);
    const pending = useRef<PendingRoute>(null);
    // The maker's start, kind, distance and terrain as they are now: a new route starts from them.
    const currentSetup = useRef<CourseSetup | null>(null);
    const top = useRef<HTMLDivElement>(null);

    // The maker opens on the event's place, once we know where it is (or that it has none).
    const ready = settingsQuery.isFetched && (locationQuery.isFetched || locationQuery.isError);
    const location = locationQuery.data;
    const details = settingsQuery.data?.location_details;
    const eventPlace: Place | undefined = location ? {
        label: details ? formatAddress(details) : t`Event location`,
        position: {lat: location.latitude, lng: location.longitude},
    } : undefined;

    const onDirtyChange = useCallback((value: PendingRoute) => {
        pending.current = value;
    }, []);
    const onSetupChange = useCallback((value: CourseSetup) => {
        currentSetup.current = value;
    }, []);

    // A route being drawn is only dropped once the organizer says so.
    const unlessDirty = (action: () => void) => {
        if (!pending.current) {
            action();
            return;
        }
        confirmationDialog(
            pending.current === 'changes'
                ? t`Replace the route in progress? Your changes will be lost.`
                : t`This route is not on the event yet. Replace it?`,
            action,
            {confirm: t`Replace`, cancel: t`Keep it`},
        );
    };

    const toTop = () => top.current?.scrollIntoView({behavior: 'smooth', block: 'start'});

    const edit = (routeFile: EventRouteFile) => unlessDirty(async () => {
        try {
            const gpx = await queryClient.fetchQuery(eventRouteFileGpxQuery(eventId!, routeFile));
            if (!gpx || gpx.points.length < 2) {
                showError(t`This GPX has no route to edit.`);
                return;
            }
            pending.current = null;
            setSaved(null);
            setEditing({routeFile, gpx});
            setRound((value) => value + 1);
            toTop();
        } catch {
            showError(t`The route could not be opened. Please try again.`);
        }
    });

    const done = (result?: SavedCourse) => {
        pending.current = null;
        setEditing(null);
        setRound((value) => value + 1);
        setSaved(result ?? null);
        if (result) {
            setSetup(result.setup);
        }
    };

    // The saved route stands out in the list for a moment, then the list is back to normal.
    useEffect(() => {
        if (!saved?.id) {
            return;
        }
        const timer = window.setTimeout(() => setSaved((current) => current && {...current, id: undefined}), 4000);
        return () => window.clearTimeout(timer);
    }, [saved]);

    // A fresh maker, from the same start: the route in progress goes once the organizer says so.
    const startNew = () => unlessDirty(() => {
        if (currentSetup.current && !editing) {
            setSetup(currentSetup.current);
        }
        done();
        toTop();
    });

    return (
        <div className={classes.page} ref={top}>
            <header className={classes.header}>
                <h1 className={classes.title}>{t`Routes`}</h1>
                <p className={classes.subtitle}>
                    {t`Draw a loop or a point-to-point route on the real trails and streets. Participants see it on the event page and download the GPX for their watch or their app.`}
                </p>
            </header>

            {ready ? (
                <CourseMaker
                    key={editing ? `edit-${editing.routeFile.id}-${round}` : `new-${round}`}
                    eventId={eventId!}
                    eventPlace={eventPlace}
                    editing={editing}
                    setup={setup}
                    savedLabel={saved?.label ?? null}
                    full={routeFiles.length >= MAX_ROUTE_FILES_PER_EVENT}
                    onDone={done}
                    onDirtyChange={onDirtyChange}
                    onSetupChange={onSetupChange}
                />
            ) : (
                <Skeleton height={640} radius={24}/>
            )}

            <div className={classes.files}>
                <RouteFilesCard eventId={eventId!} onEdit={edit} onNew={startNew}
                                editingId={editing?.routeFile.id ?? null} highlightId={saved?.id ?? null}/>
            </div>
        </div>
    );
};

export default Courses;
