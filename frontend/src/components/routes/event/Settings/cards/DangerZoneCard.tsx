import {useState} from "react";
import {useNavigate} from "react-router";
import {t} from "@lingui/macro";
import {Button, Drawer, Modal, TextInput, UnstyledButton} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {IconAlertTriangle, IconArchive, IconArchiveOff, IconTrash, IconX} from "@tabler/icons-react";
import classNames from "classnames";
import {Event, EventStatus, IdParam} from "../../../../../types.ts";
import {useGetEventDeletionStatus} from "../../../../../queries/useGetEventDeletionStatus.ts";
import {useDeleteEvent} from "../../../../../mutations/useDeleteEvent.ts";
import {useUpdateEventStatus} from "../../../../../mutations/useUpdateEventStatus.ts";
import {useIsCurrentUserAdmin} from "../../../../../hooks/useIsCurrentUserAdmin.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {showStatusChangeError} from "../../../../common/EmailNotConfirmedError";
import {CloseChoice, CloseOption} from "../../../organizer/Settings/organization/DangerZoneCard.tsx";
import settings from "../../../organizer/Settings/Settings.module.scss";
import classes from "../../../organizer/Settings/organization/CloseOrganizer.module.scss";
import extra from "../EventSettings.module.scss";

// eslint-disable-next-line lingui/no-unlocalized-strings
const PHONE = '(max-width: 767px)';

/**
 * « Archiver ou supprimer l'événement »: the same pale red box and popup as « Fermer l'organisateur »
 * (a sheet on phones). Archive (reversible, restore once archived) or delete for good, by typing the
 * event's name. Account administrators only.
 */
export const DangerZoneCard = ({eventId, event}: { eventId: IdParam, event: Event }) => {
    const navigate = useNavigate();
    const isMobile = useMediaQuery(PHONE);
    const isAdmin = useIsCurrentUserAdmin();
    const {data: deletionStatus, isLoading: isDeletionStatusLoading} = useGetEventDeletionStatus(eventId);
    const deleteMutation = useDeleteEvent();
    const statusMutation = useUpdateEventStatus();
    const [open, setOpen] = useState(false);
    const [choice, setChoice] = useState<CloseChoice>('archive');
    const [confirmation, setConfirmation] = useState('');

    const name = event.title ?? '';
    const isArchived = event.status === EventStatus.ARCHIVED;
    const canDelete = !!deletionStatus?.can_delete;
    const deleteDisabled = !canDelete || isDeletionStatusLoading;
    const isDeleteConfirmed = name !== '' && confirmation.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase();

    const openPopup = () => {
        setChoice('archive');
        setConfirmation('');
        setOpen(true);
    };

    const close = () => setOpen(false);

    const archiveOrRestore = () => statusMutation.mutate({
        eventId,
        status: isArchived ? EventStatus.LIVE : EventStatus.ARCHIVED,
    }, {
        onSuccess: () => {
            showSuccess(isArchived ? t`Event restored successfully` : t`Event archived successfully`);
            close();
        },
        onError: (error: any) => showStatusChangeError(error, t`Failed to update event status`, {
            eventId,
            organizerId: event.organizer?.id ?? event.organizer_id,
        }),
    });

    const remove = () => deleteMutation.mutate({eventId}, {
        onSuccess: () => {
            showSuccess(t`Event deleted successfully`);
            close();
            navigate(`/manage/organizer/${event.organizer?.id}/events`);
        },
        onError: (error: any) => showError(error?.response?.data?.message || t`Failed to delete event`),
    });

    const title = isArchived ? t`Restore or delete the event` : t`Archive or delete the event`;
    const archiveIcon = isArchived ? <IconArchiveOff size={18} stroke={2}/> : <IconArchive size={18} stroke={2}/>;

    const body = (
        <div className={classes.popupBody}>
            <CloseOption choice="archive" selected={choice === 'archive'} onSelect={setChoice} icon={archiveIcon}
                         title={isArchived ? t({message: 'Restore', context: 'organizer'}) : t`Archive`}
                         recommended={!isArchived}>
                <span className={classes.optionText}>
                    {isArchived
                        ? t`The event page is visible again.`
                        : t`The event page is hidden. Your data and your history are kept: you can restore it at any time.`}
                </span>
            </CloseOption>

            <CloseOption choice="delete" selected={choice === 'delete'} onSelect={setChoice} disabled={deleteDisabled}
                         icon={<IconTrash size={18} stroke={2}/>} title={t`Delete permanently`}
                         extra={choice === 'delete' && (
                             <TextInput
                                 classNames={{label: classes.confirmLabel, input: classes.confirmInput}}
                                 label={t`Type « ${name} » to confirm`}
                                 value={confirmation}
                                 data-autofocus
                                 autoComplete="off"
                                 onChange={(changeEvent) => setConfirmation(changeEvent.currentTarget.value)}
                             />
                         )}>
                <span className={classes.optionText}>
                    {!isDeletionStatusLoading && !canDelete && deletionStatus?.reason
                        ? deletionStatus.reason
                        : t`Deletes the event, its tickets and its history. This cannot be undone.`}
                </span>
            </CloseOption>

            <div className={classes.actions}>
                {choice === 'archive' ? (
                    <Button variant="transparent" className={classes.solid} leftSection={archiveIcon}
                            onClick={archiveOrRestore} loading={statusMutation.isPending}>
                        {isArchived ? t`Restore the event` : t`Archive the event`}
                    </Button>
                ) : (
                    <Button variant="transparent" className={classes.solid}
                            leftSection={<IconTrash size={18} stroke={2}/>}
                            onClick={remove} loading={deleteMutation.isPending}
                            disabled={deleteDisabled || !isDeleteConfirmed}>
                        {t`Delete permanently`}
                    </Button>
                )}
            </div>
        </div>
    );

    const heading = (
        <div className={classes.heading}>
            <span className={classes.alert}><IconAlertTriangle size={26} stroke={1.75}/></span>
            <h2 className={classes.title}>{title}</h2>
            <p className={classes.subtitle}>{t`What do you want to do with ${name}?`}</p>
        </div>
    );

    return (
        <section id="danger-zone" className={classNames(classes.box, settings.full, extra.anchored)}>
            <div className={classes.boxText}>
                <span className={classes.boxTitle}>{title}</span>
                <span className={classes.boxHint}>
                    {!isAdmin
                        ? t`Only account administrators can archive or delete an event.`
                        : isArchived
                            ? t`This event is archived: it is hidden from the public. Restore it, or delete it for good.`
                            : t`Archiving hides it from the public (can be restored). Deleting erases everything, for good.`}
                </span>
            </div>
            {isAdmin && (
                <Button variant="transparent" className={classes.outline} onClick={openPopup}>
                    {isArchived ? t`Restore or delete` : t`Archive or delete`}
                </Button>
            )}

            {isMobile ? (
                <Drawer opened={open} onClose={close} position="bottom" size="auto" withCloseButton={false}
                        classNames={{content: classes.sheet, body: classes.sheetBody}}>
                    {heading}
                    {body}
                </Drawer>
            ) : (
                <Modal opened={open} onClose={close} centered size={600} radius={32} withCloseButton={false}
                       classNames={{content: classes.popup, body: classes.popupInner}}>
                    <div className={classes.popupHead}>
                        {heading}
                        <UnstyledButton className={classes.close} onClick={close} aria-label={t`Close`}>
                            <IconX size={20} stroke={2}/>
                        </UnstyledButton>
                    </div>
                    {body}
                </Modal>
            )}
        </section>
    );
};
