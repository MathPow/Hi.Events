import {ReactNode, useState} from "react";
import {useNavigate} from "react-router";
import {t} from "@lingui/macro";
import {Button, Drawer, Modal, TextInput, UnstyledButton} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {IconAlertTriangle, IconArchive, IconArchiveOff, IconTrash, IconX} from "@tabler/icons-react";
import classNames from "classnames";
import {IdParam, OrganizerStatus} from "../../../../../types.ts";
import {useGetOrganizerDeletionStatus} from "../../../../../queries/useGetOrganizerDeletionStatus.ts";
import {useDeleteOrganizer} from "../../../../../mutations/useDeleteOrganizer.ts";
import {useUpdateOrganizerStatus} from "../../../../../mutations/useUpdateOrganizerStatus.ts";
import {useGetOrganizer} from "../../../../../queries/useGetOrganizer.ts";
import {useGetOrganizers} from "../../../../../queries/useGetOrganizers.ts";
import {useIsCurrentUserAdmin} from "../../../../../hooks/useIsCurrentUserAdmin.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {showStatusChangeError} from "../../../../common/EmailNotConfirmedError";
import settings from "../Settings.module.scss";
import classes from "./CloseOrganizer.module.scss";

type Choice = 'archive' | 'delete';

// eslint-disable-next-line lingui/no-unlocalized-strings
const PHONE = '(max-width: 767px)';

// A choice of the popup; `extra` (the name to type) sits under its text, outside its label.
const Option = ({choice, selected, onSelect, icon, title, recommended, disabled, children, extra}: {
    choice: Choice,
    selected: boolean,
    onSelect: (choice: Choice) => void,
    icon: ReactNode,
    title: string,
    recommended?: boolean,
    disabled?: boolean,
    children: ReactNode,
    extra?: ReactNode,
}) => (
    <div className={classes.option} data-selected={selected || undefined} data-disabled={disabled || undefined}>
        <label className={classes.optionLabel}>
            <input type="radio" name="close-organizer" value={choice} checked={selected} disabled={disabled}
                   onChange={() => onSelect(choice)} className={classes.radioInput}/>
            <span className={classes.radio} aria-hidden/>
            <span className={classes.optionBody}>
                <span className={classes.optionTitle}>
                    {icon}
                    {title}
                    {recommended && <span className={classes.recommended}>{t`Recommended`}</span>}
                </span>
                {children}
            </span>
        </label>
        {extra && <div className={classes.optionExtra}>{extra}</div>}
    </div>
);

/**
 * Figma « Admin · Fermer l'organisateur »: a pale red box at the bottom of Organisation, one button
 * that opens a popup (a sheet on phones). Archive (recommended, reversible; restore once archived)
 * or delete for good, by typing the organizer's name. Account administrators only.
 */
export const DangerZoneCard = ({organizerId}: { organizerId: IdParam }) => {
    const navigate = useNavigate();
    const isMobile = useMediaQuery(PHONE);
    const isAdmin = useIsCurrentUserAdmin();
    const {data: organizer} = useGetOrganizer(organizerId);
    const {data: organizers} = useGetOrganizers();
    const {data: deletionStatus, isLoading: isDeletionStatusLoading} = useGetOrganizerDeletionStatus(organizerId);
    const deleteMutation = useDeleteOrganizer();
    const statusMutation = useUpdateOrganizerStatus();
    const [open, setOpen] = useState(false);
    const [choice, setChoice] = useState<Choice>('archive');
    const [confirmation, setConfirmation] = useState('');

    const name = organizer?.name ?? '';
    const isArchived = organizer?.status === OrganizerStatus.ARCHIVED;
    const activeOrganizerCount = organizers?.data?.filter(org => org.status !== OrganizerStatus.ARCHIVED).length ?? 0;
    const isLastActiveOrganizer = !isArchived && activeOrganizerCount <= 1;
    const canDelete = !!deletionStatus?.can_delete;
    const isDeleteConfirmed = confirmation.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() && name !== '';

    const openPopup = () => {
        setChoice(isLastActiveOrganizer && canDelete ? 'delete' : 'archive');
        setConfirmation('');
        setOpen(true);
    };

    const close = () => setOpen(false);

    const archiveOrRestore = () => {
        const newStatus = isArchived ? OrganizerStatus.LIVE : OrganizerStatus.ARCHIVED;
        statusMutation.mutate({organizerId, status: newStatus}, {
            onSuccess: () => {
                showSuccess(isArchived ? t`Organizer restored successfully` : t`Organizer archived successfully`);
                close();
            },
            onError: (error: any) => showStatusChangeError(error, t`Failed to update organizer status`),
        });
    };

    const remove = () => {
        deleteMutation.mutate({organizerId}, {
            onSuccess: () => {
                showSuccess(t`Organizer deleted successfully`);
                close();
                navigate('/manage/events');
            },
            onError: (error: any) => showError(error?.response?.data?.message || t`Failed to delete organizer`),
        });
    };

    const archiveDisabled = !isArchived && isLastActiveOrganizer;
    const deleteDisabled = !canDelete || isDeletionStatusLoading;

    const body = (
        <div className={classes.popupBody}>
            <Option choice="archive" selected={choice === 'archive'} onSelect={setChoice} disabled={archiveDisabled}
                    icon={isArchived ? <IconArchiveOff size={18} stroke={2}/> : <IconArchive size={18} stroke={2}/>}
                    title={isArchived ? t({message: 'Restore', context: 'organizer'}) : t`Archive`} recommended={!isArchived && !archiveDisabled}>
                <span className={classes.optionText}>
                    {isArchived
                        ? t`The page and the events are visible again.`
                        : archiveDisabled
                            ? t`You cannot archive the last active organizer on your account.`
                            : t`The page and the events are hidden. Your data and your history are kept: you can restore it at any time.`}
                </span>
            </Option>

            <Option choice="delete" selected={choice === 'delete'} onSelect={setChoice} disabled={deleteDisabled}
                    icon={<IconTrash size={18} stroke={2}/>} title={t`Delete permanently`}
                    extra={choice === 'delete' && (
                        <TextInput
                            classNames={{label: classes.confirmLabel, input: classes.confirmInput}}
                            label={t`Type « ${name} » to confirm`}
                            value={confirmation}
                            data-autofocus
                            autoComplete="off"
                            onChange={(event) => setConfirmation(event.currentTarget.value)}
                        />
                    )}>
                <span className={classes.optionText}>
                    {!isDeletionStatusLoading && !canDelete && deletionStatus?.reason
                        ? deletionStatus.reason
                        : t`Deletes the page, the events, the orders and the history. This cannot be undone.`}
                </span>
            </Option>

            <div className={classes.actions}>
                {choice === 'archive' ? (
                    <Button variant="transparent" className={classes.solid}
                            leftSection={isArchived ? <IconArchiveOff size={18} stroke={2}/> : <IconArchive size={18} stroke={2}/>}
                            onClick={archiveOrRestore} loading={statusMutation.isPending} disabled={archiveDisabled}>
                        {isArchived ? t`Restore the organizer` : t`Archive the organizer`}
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
            <h2 className={classes.title}>{t`Close the organizer`}</h2>
            <p className={classes.subtitle}>{t`What do you want to do with ${name}?`}</p>
        </div>
    );

    return (
        <section className={classNames(classes.box, settings.full)}>
            <div className={classes.boxText}>
                <span className={classes.boxTitle}>{t`Close the organizer`}</span>
                <span className={classes.boxHint}>
                    {!isAdmin
                        ? t`Only account administrators can archive or delete an organizer.`
                        : isArchived
                            ? t`This organizer is archived: its page and its events are hidden. Restore it, or delete it permanently.`
                            : t`Archive it to set it aside, or delete it permanently.`}
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
