import {useState} from "react";
import {useNavigate} from "react-router";
import {t} from "@lingui/macro";
import {Button, Modal, TextInput} from "@mantine/core";
import {Event, EventStatus, IdParam} from "../../../../../types.ts";
import {useGetEventDeletionStatus} from "../../../../../queries/useGetEventDeletionStatus.ts";
import {useDeleteEvent} from "../../../../../mutations/useDeleteEvent.ts";
import {useUpdateEventStatus} from "../../../../../mutations/useUpdateEventStatus.ts";
import {useIsCurrentUserAdmin} from "../../../../../hooks/useIsCurrentUserAdmin.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../utilites/confirmationDialog.tsx";
import {showStatusChangeError} from "../../../../common/EmailNotConfirmedError";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

// « Zone de danger »: archive (or restore) and delete the event, like the organizer's. Administrators only.
export const DangerZoneCard = ({eventId, event}: { eventId: IdParam, event: Event }) => {
    const navigate = useNavigate();
    const isAdmin = useIsCurrentUserAdmin();
    const {data: deletionStatus, isLoading: isDeletionStatusLoading} = useGetEventDeletionStatus(eventId);
    const deleteMutation = useDeleteEvent();
    const statusMutation = useUpdateEventStatus();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');

    const isArchived = event.status === EventStatus.ARCHIVED;
    const confirmationPhrase = t`delete`;
    const isDeleteConfirmed = confirmation.trim().toLocaleLowerCase() === confirmationPhrase.toLocaleLowerCase();
    const canDelete = !!deletionStatus?.can_delete;

    const handleArchiveToggle = () => confirmationDialog(
        isArchived
            ? t`Are you sure you want to restore this event?`
            : t`Are you sure you want to archive this event? It will no longer be visible to the public.`,
        () => statusMutation.mutate({eventId, status: isArchived ? EventStatus.LIVE : EventStatus.ARCHIVED}, {
            onSuccess: () => showSuccess(isArchived ? t`Event restored successfully` : t`Event archived successfully`),
            onError: (error: any) => showStatusChangeError(error, t`Failed to update event status`),
        }),
        {confirm: isArchived ? t`Restore` : t`Archive`, cancel: t`Cancel`},
    );

    const handleDelete = () => deleteMutation.mutate({eventId}, {
        onSuccess: () => {
            showSuccess(t`Event deleted successfully`);
            navigate(`/manage/organizer/${event.organizer?.id}/events`);
        },
        onError: (error: any) => showError(error?.response?.data?.message || t`Failed to delete event`),
    });

    const deleteHint = !isDeletionStatusLoading && !canDelete && deletionStatus?.reason
        ? deletionStatus.reason
        : t`Deletes the event, its tickets and its history. This cannot be undone.`;

    return (
        <section id="danger-zone" className={`${classes.danger} ${classes.full} ${extra.anchored}`}>
            <div className={classes.cardHeadText}>
                <h2 className={classes.cardTitle}>{t({message: 'Danger zone', context: 'settings'})}</h2>
                <p className={classes.cardSubtitle}>{t`These actions are permanent or hard to undo.`}</p>
            </div>

            {!isAdmin && (
                <div className={classes.dangerRow}>
                    <div className={classes.dangerText}>
                        <span className={classes.dangerTitle}>{t`Admin Access Required`}</span>
                        <span className={classes.dangerHint}>
                            {t`Only account administrators can delete or archive events. Contact your account admin for assistance.`}
                        </span>
                    </div>
                </div>
            )}

            {isAdmin && (
                <>
                    <div className={classes.dangerRow}>
                        <div className={classes.dangerText}>
                            <span className={classes.dangerTitle}>{isArchived ? t`Restore Event` : t`Archive Event`}</span>
                            <span className={classes.dangerHint}>
                                {isArchived
                                    ? t`Restore this event to make it visible again.`
                                    : t`Archive this event to hide it from the public. You can restore it later.`}
                            </span>
                        </div>
                        <Button
                            variant="transparent"
                            className={classes.dangerOutline}
                            onClick={handleArchiveToggle}
                            loading={statusMutation.isPending}
                        >
                            {isArchived ? t`Restore` : t`Archive`}
                        </Button>
                    </div>

                    <div className={classes.dangerRow}>
                        <div className={classes.dangerText}>
                            <span className={classes.dangerTitle}>{t`Delete Event`}</span>
                            <span className={classes.dangerHint}>{deleteHint}</span>
                        </div>
                        <Button
                            variant="transparent"
                            className={classes.dangerSolid}
                            leftSection={<img src="/interface/admin/parametres/corbeille-blanche.svg" alt=""/>}
                            onClick={() => setDeleteOpen(true)}
                            disabled={!canDelete || isDeletionStatusLoading}
                        >
                            {t`Delete`}
                        </Button>
                    </div>
                </>
            )}

            <Modal
                opened={deleteOpen}
                onClose={() => {
                    setDeleteOpen(false);
                    setConfirmation('');
                }}
                title={t`Delete Event`}
                centered
            >
                <div className={classes.cardBody}>
                    <p className={classes.bodyText}>{t`Permanently delete this event and all its associated data.`}</p>
                    <TextInput
                        className={classes.field}
                        label={t`Type "delete" to confirm`}
                        placeholder={confirmationPhrase}
                        value={confirmation}
                        data-autofocus
                        onChange={(changeEvent) => setConfirmation(changeEvent.currentTarget.value)}
                    />
                    <Button
                        variant="transparent"
                        className={`${classes.dangerSolid} ${classes.fullWidth}`}
                        leftSection={<img src="/interface/admin/parametres/corbeille-blanche.svg" alt=""/>}
                        onClick={handleDelete}
                        loading={deleteMutation.isPending}
                        disabled={!isDeleteConfirmed}
                    >
                        {t`Delete Event`}
                    </Button>
                </div>
            </Modal>
        </section>
    );
};
