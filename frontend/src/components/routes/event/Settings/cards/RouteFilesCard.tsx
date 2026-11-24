import {KeyboardEvent, useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Button, FileButton, Skeleton, TextInput} from "@mantine/core";
import {IconDownload, IconPencil, IconPlus, IconRoute, IconTrash, IconUpload} from "@tabler/icons-react";
import {IdParam} from "../../../../../types.ts";
import {
    EventRouteFile,
    eventRouteFileClientPublic,
    formatRouteFileSize,
    MAX_ROUTE_FILE_BYTES,
    MAX_ROUTE_FILES_PER_EVENT,
} from "../../../../../api/eventRouteFile.client.ts";
import {useGetEventRouteFiles} from "../../../../../queries/useGetEventRouteFiles.ts";
import {useGetEventRouteFileGpx} from "../../../../../queries/useGetEventRouteFileGpx.ts";
import {
    useDeleteEventRouteFile,
    useRenameEventRouteFile,
    useUploadEventRouteFile,
} from "../../../../../mutations/useEventRouteFileMutations.ts";
import {useAutosaveStatus} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {showError} from "../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../utilites/confirmationDialog.tsx";
import {elevationGain, haversine, pathDistance} from "../../../../../utilites/course/geo.ts";
import {CourseShape} from "../../../../common/CourseMap/CourseShape.tsx";
import {formatClimb, formatKm} from "../../../../common/CourseMap/courseFormat.ts";
import {serverMessage} from "../../../organizer/Settings/SettingsUi.tsx";
import local from "./RouteFilesCard.module.scss";

const SHAPE_COLOR = '#c2532b';

const uploadError = (error: any): string => {
    const messages = error?.response?.data?.errors?.file;
    return messages ? serverMessage(messages) : t`The GPX file could not be added. Please try again.`;
};

interface RouteFilesCardProps {
    eventId: IdParam;
    onEdit?: (routeFile: EventRouteFile) => void;
    onNew?: () => void;
    // The route open in the maker, and the one just saved (lit up for a moment).
    editingId?: number | null;
    highlightId?: number | null;
}

/**
 * « Parcours de l'événement »: the courses participants load in their watch or phone, downloaded from
 * the event page, their ticket and their ticket email. Up to 5 files of 10 MB, each with a name
 * (« 10 km »), drawn in the course maker above it or added as a GPX.
 */
export const RouteFilesCard = ({eventId, onEdit, onNew, editingId, highlightId}: RouteFilesCardProps) => {
    const routeFilesQuery = useGetEventRouteFiles(eventId);
    const uploadMutation = useUploadEventRouteFile();
    const deleteMutation = useDeleteEventRouteFile();
    const routeFiles = routeFilesQuery.data ?? [];
    const full = routeFiles.length >= MAX_ROUTE_FILES_PER_EVENT;
    // Lets the same file be chosen again after a refusal.
    const resetPicker = useRef<() => void>(null);

    const upload = async (files: File[]) => {
        resetPicker.current?.();
        const remaining = MAX_ROUTE_FILES_PER_EVENT - routeFiles.length;
        if (files.length > remaining) {
            showError(t`An event can have up to ${MAX_ROUTE_FILES_PER_EVENT} GPX files.`);
        }

        for (const file of files.slice(0, Math.max(0, remaining))) {
            if (!file.name.toLowerCase().endsWith('.gpx')) {
                showError(t`Choose a GPX file.`);
                continue;
            }
            if (file.size > MAX_ROUTE_FILE_BYTES) {
                showError(t`The GPX file must be 10 MB or less.`);
                continue;
            }
            try {
                await uploadMutation.mutateAsync({eventId, file});
            } catch (error) {
                showError(uploadError(error));
            }
        }
    };

    const remove = (routeFile: EventRouteFile) => {
        const label = routeFile.label;
        confirmationDialog(
            t`Delete the route « ${label} »? Participants will no longer be able to download it.`,
            () => deleteMutation.mutate(
                {eventId, routeFileId: routeFile.id},
                {onError: () => showError(t`The route could not be deleted. Please try again.`)},
            ),
            {confirm: t`Delete`, cancel: t`Cancel`},
        );
    };

    return (
        <section id="route-files" className={local.card}>
            <header className={local.head}>
                <div className={local.headText}>
                    <h2 className={local.title}>
                        {t`The event's routes`}
                        {!routeFilesQuery.isLoading && !routeFilesQuery.isError && (
                            <span className={local.count}>{`${routeFiles.length} / ${MAX_ROUTE_FILES_PER_EVENT}`}</span>
                        )}
                    </h2>
                    <p className={local.subtitle}>
                        {t`Participants download them from the event page, their ticket and their ticket email.`}
                    </p>
                </div>
                <FileButton onChange={upload} accept=".gpx,application/gpx+xml" multiple disabled={full}
                            resetRef={resetPicker}>
                    {(props) => (
                        <Button {...props} variant="default" className={local.importButton}
                                leftSection={<IconUpload size={18}/>}
                                loading={uploadMutation.isPending} disabled={full || routeFilesQuery.isLoading}>
                            {t`Add a GPX`}
                        </Button>
                    )}
                </FileButton>
            </header>

            {routeFilesQuery.isLoading ? (
                <div className={local.list}>
                    <Skeleton height={72} radius={18}/>
                    <Skeleton height={72} radius={18}/>
                </div>
            ) : routeFilesQuery.isError ? (
                <div className={local.problem} role="alert">
                    <span>{t`The routes could not be loaded.`}</span>
                    <Button variant="subtle" size="compact-sm" className={local.linkButton}
                            onClick={() => routeFilesQuery.refetch()}>
                        {t`Try again`}
                    </Button>
                </div>
            ) : routeFiles.length === 0 ? (
                <p className={local.empty}>
                    {t`No route yet. Draw one above, or add a GPX file you already have.`}
                </p>
            ) : (
                <div className={local.list}>
                    {routeFiles.map((routeFile) => (
                        <RouteFileRow key={routeFile.id} eventId={eventId} routeFile={routeFile}
                                      editing={editingId === routeFile.id}
                                      highlighted={highlightId === routeFile.id}
                                      onEdit={onEdit ? () => onEdit(routeFile) : undefined}
                                      onDelete={() => remove(routeFile)}/>
                    ))}
                </div>
            )}

            {onNew && !full && !routeFilesQuery.isLoading && !routeFilesQuery.isError && (
                <button type="button" className={local.addRow} onClick={onNew}>
                    <IconPlus size={18}/>
                    {t`Draw a new route`}
                </button>
            )}

            <p className={local.hint}>
                {t`Up to ${MAX_ROUTE_FILES_PER_EVENT} .gpx files of 10 MB each.`}
            </p>
        </section>
    );
};

const RouteFileRow = ({eventId, routeFile, editing, highlighted, onEdit, onDelete}: {
    eventId: IdParam,
    routeFile: EventRouteFile,
    editing: boolean,
    highlighted: boolean,
    onEdit?: () => void,
    onDelete: () => void,
}) => {
    const renameMutation = useRenameEventRouteFile();
    const track = useAutosaveStatus();
    const gpx = useGetEventRouteFileGpx(eventId, routeFile).data;
    const [label, setLabel] = useState(routeFile.label);
    const row = useRef<HTMLDivElement>(null);

    useEffect(() => setLabel(routeFile.label), [routeFile.label]);

    // The route just saved comes into view, lit up.
    useEffect(() => {
        if (highlighted) {
            row.current?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
        }
    }, [highlighted]);

    const size = formatRouteFileSize(routeFile.size);
    const points = gpx?.points ?? [];
    const figures = (() => {
        if (points.length < 2) {
            return t`GPX · ${size}`;
        }
        const loop = gpx?.design ? gpx.design.kind === 'loop' : haversine(points[0], points[points.length - 1]) < 80;
        const climb = formatClimb(gpx?.design?.ascentM ?? elevationGain(points));
        return [loop ? t`Loop` : t`Point to point`, formatKm(pathDistance(points)), t`${climb} of climb`].join(' · ');
    })();

    const save = () => {
        const next = label.trim();
        if (next === '' || next === routeFile.label) {
            setLabel(routeFile.label);
            return;
        }

        const run = () => renameMutation.mutateAsync({eventId, routeFileId: routeFile.id, label: next});
        track(`route-file-${routeFile.id}`, run, save)
            .catch(() => showError(t`The route name could not be saved. Please try again.`));
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
            setLabel(routeFile.label);
        }
    };

    return (
        <div ref={row} className={local.row} data-editing={editing || undefined} data-highlighted={highlighted || undefined}>
            <span className={local.thumb} aria-hidden>
                {points.length > 1
                    ? <CourseShape points={points} color={SHAPE_COLOR} size={48}/>
                    : <IconRoute size={22} stroke={1.75}/>}
            </span>
            <span className={local.text}>
                <span className={local.nameLine}>
                    <TextInput
                        className={local.labelInput}
                        aria-label={t`Route name`}
                        value={label}
                        maxLength={100}
                        onChange={(event) => setLabel(event.currentTarget.value)}
                        onBlur={save}
                        onKeyDown={onKeyDown}
                    />
                    {editing && <span className={local.editingTag}>{t`Being edited`}</span>}
                </span>
                <span className={local.meta}>{figures}</span>
            </span>
            <span className={local.actions}>
                {onEdit && (
                    <button type="button" className={local.iconButton} aria-label={t`Edit on the map`}
                            title={t`Edit on the map`} onClick={onEdit} disabled={editing}>
                        <IconPencil size={19}/>
                    </button>
                )}
                <a className={local.iconButton} href={eventRouteFileClientPublic.downloadUrl(eventId, routeFile.id)}
                   aria-label={t`Download`} title={t`Download`}>
                    <IconDownload size={19}/>
                </a>
                <button type="button" className={local.iconButton} data-tone="danger" aria-label={t`Delete`}
                        title={t`Delete`} onClick={onDelete}>
                    <IconTrash size={19}/>
                </button>
            </span>
        </div>
    );
};
