import {useState} from "react";
import {useNavigate} from "react-router";
import {t} from "@lingui/macro";
import {Button, Modal, TextInput} from "@mantine/core";
import {IdParam, OrganizerStatus} from "../../../../../types.ts";
import {useGetOrganizerDeletionStatus} from "../../../../../queries/useGetOrganizerDeletionStatus.ts";
import {useDeleteOrganizer} from "../../../../../mutations/useDeleteOrganizer.ts";
import {useUpdateOrganizerStatus} from "../../../../../mutations/useUpdateOrganizerStatus.ts";
import {useGetOrganizer} from "../../../../../queries/useGetOrganizer.ts";
import {useGetOrganizers} from "../../../../../queries/useGetOrganizers.ts";
import {useIsCurrentUserAdmin} from "../../../../../hooks/useIsCurrentUserAdmin.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../utilites/confirmationDialog.tsx";
import {showStatusChangeError} from "../../../../common/EmailNotConfirmedError";
import classes from "../Settings.module.scss";

// « Zone de danger »: archive (or restore) and delete the organizer. Account administrators only.
export const DangerZoneCard = ({organizerId}: { organizerId: IdParam }) => {
    const navigate = useNavigate();
    const isAdmin = useIsCurrentUserAdmin();
    const {data: organizer} = useGetOrganizer(organizerId);
    const {data: organizers} = useGetOrganizers();
    const {data: deletionStatus, isLoading: isDeletionStatusLoading} = useGetOrganizerDeletionStatus(organizerId);
    const deleteMutation = useDeleteOrganizer();
    const statusMutation = useUpdateOrganizerStatus();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [confirmation, setConfirmation] = useState('');

    const isArchived = organizer?.status === OrganizerStatus.ARCHIVED;
    const activeOrganizerCount = organizers?.data?.filter(org => org.status !== OrganizerStatus.ARCHIVED).length ?? 0;
    const isLastActiveOrganizer = !isArchived && activeOrganizerCount <= 1;
    const confirmationPhrase = t`delete`;
    const isDeleteConfirmed = confirmation.trim().toLocaleLowerCase() === confirmationPhrase.toLocaleLowerCase();
    const canDelete = !!deletionStatus?.can_delete;

    const handleArchiveToggle = () => {
        const newStatus = isArchived ? OrganizerStatus.LIVE : OrganizerStatus.ARCHIVED;
        confirmationDialog(
            isArchived
                ? t`Are you sure you want to restore this organizer?`
                : t`Are you sure you want to archive this organizer? This will also archive all events belonging to this organizer.`,
            () => statusMutation.mutate({organizerId, status: newStatus}, {
                onSuccess: () => showSuccess(isArchived ? t`Organizer restored successfully` : t`Organizer archived successfully`),
                onError: (error: any) => showStatusChangeError(error, t`Failed to update organizer status`),
            }),
            {confirm: isArchived ? t`Restore` : t`Archive`, cancel: t`Cancel`},
        );
    };

    const handleDelete = () => {
        deleteMutation.mutate({organizerId}, {
            onSuccess: () => {
                showSuccess(t`Organizer deleted successfully`);
                navigate('/manage/events');
            },
            onError: (error: any) => showError(error?.response?.data?.message || t`Failed to delete organizer`),
        });
    };

    const deleteHint = !isDeletionStatusLoading && !canDelete && deletionStatus?.reason
        ? deletionStatus.reason
        : t`Deletes the page, the events and their history. This cannot be undone.`;

    return (
        <section className={`${classes.danger} ${classes.full}`}>
            <div className={classes.cardHeadText}>
                <h2 className={classes.cardTitle}>{t({message: 'Danger zone', context: 'settings'})}</h2>
                <p className={classes.cardSubtitle}>{t`These actions are permanent or hard to undo.`}</p>
            </div>

            {!isAdmin && (
                <div className={classes.dangerRow}>
                    <div className={classes.dangerText}>
                        <span className={classes.dangerTitle}>{t`Admin Access Required`}</span>
                        <span className={classes.dangerHint}>
                            {t`Only account administrators can delete or archive organizers. Contact your account admin for assistance.`}
                        </span>
                    </div>
                </div>
            )}

            {isAdmin && (
                <>
                    <div className={classes.dangerRow}>
                        <div className={classes.dangerText}>
                            <span className={classes.dangerTitle}>
                                {isArchived ? t`Restore Organizer` : t`Archive the organizer`}
                            </span>
                            <span className={classes.dangerHint}>
                                {isArchived
                                    ? t`Restore this organizer and make it active again.`
                                    : isLastActiveOrganizer
                                        ? t`You cannot archive the last active organizer on your account.`
                                        : t`Hides the page and the events. You can bring it back.`}
                            </span>
                        </div>
                        <Button
                            variant="transparent"
                            className={classes.dangerOutline}
                            onClick={handleArchiveToggle}
                            loading={statusMutation.isPending}
                            disabled={!isArchived && isLastActiveOrganizer}
                        >
                            {isArchived ? t`Restore` : t`Archive`}
                        </Button>
                    </div>

                    <div className={classes.dangerRow}>
                        <div className={classes.dangerText}>
                            <span className={classes.dangerTitle}>{t`Delete the organizer`}</span>
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
                title={t`Delete the organizer`}
                centered
            >
                <div className={classes.cardBody}>
                    <p className={classes.bodyText}>{t`Permanently delete this organizer and all its events.`}</p>
                    <TextInput
                        className={classes.field}
                        label={t`Type "delete" to confirm`}
                        placeholder={confirmationPhrase}
                        value={confirmation}
                        data-autofocus
                        onChange={(event) => setConfirmation(event.currentTarget.value)}
                    />
                    <Button
                        variant="transparent"
                        className={`${classes.dangerSolid} ${classes.fullWidth}`}
                        leftSection={<img src="/interface/admin/parametres/corbeille-blanche.svg" alt=""/>}
                        onClick={handleDelete}
                        loading={deleteMutation.isPending}
                        disabled={!isDeleteConfirmed}
                    >
                        {t`Delete the organizer`}
                    </Button>
                </div>
            </Modal>
        </section>
    );
};
