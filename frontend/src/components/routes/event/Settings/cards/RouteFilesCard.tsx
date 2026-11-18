import {KeyboardEvent, useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Button, FileButton, Skeleton, TextInput} from "@mantine/core";
import {IconDownload, IconRoute, IconTrash} from "@tabler/icons-react";
import {IdParam} from "../../../../../types.ts";
import {
    EventRouteFile,
    eventRouteFileClientPublic,
    formatRouteFileSize,
    MAX_ROUTE_FILE_BYTES,
    MAX_ROUTE_FILES_PER_EVENT,
} from "../../../../../api/eventRouteFile.client.ts";
import {useGetEventRouteFiles} from "../../../../../queries/useGetEventRouteFiles.ts";
import {
    useDeleteEventRouteFile,
    useRenameEventRouteFile,
    useUploadEventRouteFile,
} from "../../../../../mutations/useEventRouteFileMutations.ts";
import {useAutosaveStatus} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {showError} from "../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../utilites/confirmationDialog.tsx";
import {serverMessage, SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";
import local from "./RouteFilesCard.module.scss";

const uploadError = (error: any): string => {
    const messages = error?.response?.data?.errors?.file;
    return messages ? serverMessage(messages) : t`The GPX file could not be added. Please try again.`;
};

/**
 * « Parcours (GPX) »: the courses participants load in their watch or phone, downloaded from their
 * ticket and their ticket email. Up to 5 files of 10 MB, each with a name (« 10 km »).
 */
export const RouteFilesCard = ({eventId}: { eventId: IdParam }) => {
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
        <SettingsCard
            id="route-files"
            className={extra.anchored}
            title={t`Route (GPX)`}
            subtitle={t`The course to load in a watch or a phone. Participants download it from their ticket and their ticket email.`}
            action={(
                <FileButton onChange={upload} accept=".gpx,application/gpx+xml" multiple disabled={full}
                            resetRef={resetPicker}>
                    {(props) => (
                        <Button {...props} variant="transparent" className={classes.inkButton}
                                loading={uploadMutation.isPending} disabled={full || routeFilesQuery.isLoading}>
                            {t`Add a GPX`}
                        </Button>
                    )}
                </FileButton>
            )}
        >
            {routeFilesQuery.isLoading ? (
                <Skeleton height={64} radius="md"/>
            ) : routeFiles.length === 0 ? (
                <p className={classes.empty}>
                    {t`No route yet. Add a GPX file: participants will be able to download it from their ticket.`}
                </p>
            ) : (
                <div className={classes.list}>
                    {routeFiles.map((routeFile) => (
                        <RouteFileRow key={routeFile.id} eventId={eventId} routeFile={routeFile}
                                      onDelete={() => remove(routeFile)}/>
                    ))}
                </div>
            )}

            <p className={classes.softHint}>
                {t`Up to ${MAX_ROUTE_FILES_PER_EVENT} .gpx files of 10 MB each.`}
            </p>
        </SettingsCard>
    );
};

const RouteFileRow = ({eventId, routeFile, onDelete}: {
    eventId: IdParam,
    routeFile: EventRouteFile,
    onDelete: () => void,
}) => {
    const renameMutation = useRenameEventRouteFile();
    const track = useAutosaveStatus();
    const [label, setLabel] = useState(routeFile.label);

    useEffect(() => setLabel(routeFile.label), [routeFile.label]);

    const size = formatRouteFileSize(routeFile.size);
    const filename = routeFile.original_filename;

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
        <div className={classes.listRow}>
            <span className={local.icon} aria-hidden><IconRoute size={20} stroke={1.75}/></span>
            <span className={classes.listRowText}>
                <TextInput
                    className={local.labelInput}
                    aria-label={t`Route name`}
                    value={label}
                    maxLength={100}
                    onChange={(event) => setLabel(event.currentTarget.value)}
                    onBlur={save}
                    onKeyDown={onKeyDown}
                />
                <span className={classes.listRowHint}>{t`GPX · ${size} · ${filename}`}</span>
            </span>
            <a className={classes.iconButton} href={eventRouteFileClientPublic.downloadUrl(eventId, routeFile.id)}
               aria-label={t`Download`} title={t`Download`}>
                <IconDownload size={18}/>
            </a>
            <button type="button" className={classes.iconButton} aria-label={t`Delete`} title={t`Delete`}
                    onClick={onDelete}>
                <IconTrash size={18} color="#c8442f"/>
            </button>
        </div>
    );
};
