import {useCallback, useRef, useState} from "react";
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
import {CourseMaker, CourseToEdit} from "./CourseMaker.tsx";
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
    const [savedId, setSavedId] = useState<number | null>(null);
    const dirty = useRef(false);
    const top = useRef<HTMLDivElement>(null);

    // The maker opens on the event's place, once we know where it is (or that it has none).
    const ready = settingsQuery.isFetched && (locationQuery.isFetched || locationQuery.isError);
    const location = locationQuery.data;
    const details = settingsQuery.data?.location_details;
    const eventPlace: Place | undefined = location ? {
        label: details ? formatAddress(details) : t`Event location`,
        position: {lat: location.latitude, lng: location.longitude},
    } : undefined;

    const onDirtyChange = useCallback((value: boolean) => {
        dirty.current = value;
    }, []);

    // A route being drawn is only dropped once the organizer says so.
    const unlessDirty = (action: () => void) => {
        if (!dirty.current) {
            action();
            return;
        }
        confirmationDialog(t`Replace the route in progress? Your changes will be lost.`, action,
            {confirm: t`Replace`, cancel: t`Keep it`});
    };

    const toTop = () => top.current?.scrollIntoView({behavior: 'smooth', block: 'start'});

    const edit = (routeFile: EventRouteFile) => unlessDirty(async () => {
        try {
            const gpx = await queryClient.fetchQuery(eventRouteFileGpxQuery(eventId!, routeFile));
            if (!gpx || gpx.points.length < 2) {
                showError(t`This GPX has no route to edit.`);
                return;
            }
            dirty.current = false;
            setSavedId(null);
            setEditing({routeFile, gpx});
            setRound((value) => value + 1);
            toTop();
        } catch {
            showError(t`The route could not be opened. Please try again.`);
        }
    });

    const done = (saved?: number) => {
        dirty.current = false;
        setEditing(null);
        setRound((value) => value + 1);
        setSavedId(saved ?? null);
    };

    const startNew = () => {
        if (editing) {
            unlessDirty(() => {
                done();
                toTop();
            });
            return;
        }
        toTop();
    };

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
                    full={routeFiles.length >= MAX_ROUTE_FILES_PER_EVENT}
                    onDone={done}
                    onDirtyChange={onDirtyChange}
                />
            ) : (
                <Skeleton height={640} radius={24}/>
            )}

            <div className={classes.files}>
                <RouteFilesCard eventId={eventId!} onEdit={edit} onNew={startNew}
                                editingId={editing?.routeFile.id ?? null} highlightId={savedId}/>
            </div>
        </div>
    );
};

export default Courses;
