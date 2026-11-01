import {CheckInList, IdParam} from "../../../types";
import {ActionIcon, Button, UnstyledButton} from "@mantine/core";
import {t, Trans} from "@lingui/macro";
import {IconCopy, IconDotsVertical, IconExternalLink, IconHelp, IconPencil, IconPlus, IconTrash} from "@tabler/icons-react";
import {NoResultsSplash} from "../NoResultsSplash";
import classes from './CheckInListList.module.scss';
import {Popover} from "../Popover";
import {useState} from "react";
import {ActionMenu} from "../ActionMenu";
import {useDisclosure} from "@mantine/hooks";
import {EditCheckInListModal} from "../../modals/EditCheckInListModal";
import {useDeleteCheckInList} from "../../../mutations/useDeleteCheckInList";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {useParams} from "react-router";
import {StatusTag, StatusTone} from "../StatusTag";
import {PublicIcon} from "../PublicIcon";
import {useGetEvent} from "../../../queries/useGetEvent.ts";
import {prettyDate} from "../../../utilites/dates.ts";
import {formatNumber} from "../../../utilites/helpers.ts";

interface CheckInListListProps {
    checkInLists: CheckInList[];
    openCreateModal: () => void;
}

const listStatus = (list: CheckInList): { label: string, tone: StatusTone, message: string } => {
    if (list.is_expired) {
        return {
            label: t({message: 'Expired', context: 'check-in list'}),
            tone: 'neutral',
            message: t`This check-in list has expired`,
        };
    }

    if (!list.is_active) {
        return {
            label: t({message: 'Not active yet', context: 'check-in list'}),
            tone: 'waiting',
            message: t`This check-in list is not active yet`,
        };
    }

    return {label: t`Active`, tone: 'ok', message: t`This check-in list is active`};
};

const checkInUrl = (list: CheckInList) => `${window.location.origin}/check-in/${list.short_id}`;

// The check-in lists as cream cards: name and state, the tickets it covers, how many attendees
// are checked in, and the link to share with the volunteers at the door.
export const CheckInListList = ({checkInLists, openCreateModal}: CheckInListListProps) => {
    const [editModalOpen, {open: openEditModal, close: closeEditModal}] = useDisclosure(false);
    const [selectedCheckInListId, setSelectedCheckInListId] = useState<IdParam>();
    const deleteMutation = useDeleteCheckInList();
    const {eventId} = useParams();
    const {data: event} = useGetEvent(eventId);

    const handleDeleteCheckInList = (checkInListId: IdParam, eventId: IdParam) => {
        deleteMutation.mutate({checkInListId, eventId}, {
            onSuccess: () => {
                showSuccess(t`Check-In List deleted successfully`);
            },
            onError: (error: any) => {
                showError(error.message);
            }
        });
    }

    const copyUrl = (list: CheckInList) => {
        navigator.clipboard.writeText(checkInUrl(list)).then(() => {
            showSuccess(t`Check-In URL copied to clipboard`);
        });
    };

    const openPage = (list: CheckInList) => window.open(`/check-in/${list.short_id}`, '_blank');

    if (checkInLists.length === 0) {
        return (
            <NoResultsSplash
                heading={t`No Check-In Lists`}
                icon="qr"
                subHeading={(
                    <Trans>
                        <p>
                            Check-in lists help you manage event entry by day, area, or ticket type. You can link tickets to specific lists such as VIP zones or Day 1 passes and share a secure check-in link with staff. No account is required. Check-in works on mobile, desktop, or tablet, using a device camera or HID USB scanner.                                </p>
                    </Trans>
                )}
            >
                <Button leftSection={<IconPlus size={20}/>} onClick={() => openCreateModal()}>
                    {t`Create Check-In List`}
                </Button>
            </NoResultsSplash>
        );
    }

    return (
        <>
            <div className={classes.checkInListList}>
                {checkInLists.map((list) => {
                    const status = listStatus(list);
                    const percentage = list.total_attendees > 0
                        ? Math.min(100, (list.checked_in_attendees / list.total_attendees) * 100)
                        : 0;
                    const isComplete = list.total_attendees > 0 && list.checked_in_attendees >= list.total_attendees;
                    const dateNote = (() => {
                        if (!event?.timezone) {
                            return null;
                        }
                        if (!list.is_active && !list.is_expired && list.activates_at) {
                            return t`Opens ${prettyDate(list.activates_at, event.timezone)}`;
                        }
                        if (!list.is_expired && list.expires_at) {
                            return t`Closes ${prettyDate(list.expires_at, event.timezone)}`;
                        }
                        return null;
                    })();

                    return (
                        <article className={classes.card} key={list.id}>
                            <div className={classes.head}>
                                <span className={classes.pastille} aria-hidden>
                                    <PublicIcon name="qr" size={20}/>
                                </span>
                                <div className={classes.titleBlock}>
                                    <h2 className={classes.name}>{list.name}</h2>
                                    <div className={classes.meta}>
                                        <StatusTag tone={status.tone} title={status.message}>{status.label}</StatusTag>
                                        {!!list.products?.length && (
                                            <Popover
                                                title={list.products.map((product) => (
                                                    <div key={product.id}>
                                                        {product.title}
                                                    </div>
                                                ))}
                                                position={'bottom'}
                                                withArrow
                                            >
                                                <UnstyledButton className={classes.products}>
                                                    {list.products.length > 1
                                                        ? <Trans>Includes {list.products.length} products</Trans>
                                                        : t`Includes 1 product`}
                                                    <IconHelp size={16}/>
                                                </UnstyledButton>
                                            </Popover>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={classes.progress}>
                                <div className={classes.count}>
                                    <span className={classes.countValue}>{formatNumber(list.checked_in_attendees)}</span>
                                    <span className={classes.countTotal}>/ {formatNumber(list.total_attendees)}</span>
                                    <span className={classes.countLabel}>
                                        {t({message: 'checked in', context: 'check-in list count'})}
                                    </span>
                                </div>
                                <span
                                    className={classes.bar}
                                    data-level={isComplete ? 'done' : undefined}
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.round(percentage)}
                                >
                                    <span style={{width: `${percentage}%`}}/>
                                </span>
                                {dateNote && <span className={classes.dateNote}>{dateNote}</span>}
                            </div>

                            <div className={classes.actions}>
                                <Button
                                    variant="outline"
                                    className={classes.copyButton}
                                    leftSection={<IconCopy size={18}/>}
                                    onClick={() => copyUrl(list)}
                                    title={t`Copy Check-In URL`}
                                >
                                    {t({message: 'Copy link', context: 'check-in list'})}
                                </Button>
                                <ActionIcon
                                    variant="subtle"
                                    className={classes.roundButton}
                                    onClick={() => openPage(list)}
                                    aria-label={t({message: 'Open Check-In Page', context: 'check-in list'})}
                                    title={t({message: 'Open Check-In Page', context: 'check-in list'})}
                                >
                                    <IconExternalLink size={20}/>
                                </ActionIcon>
                                <ActionMenu
                                    target={(
                                        <ActionIcon variant="subtle" className={classes.roundButton} aria-label={t`Actions`}>
                                            <IconDotsVertical size={20}/>
                                        </ActionIcon>
                                    )}
                                    itemsGroups={[
                                        {
                                            label: t`Manage`,
                                            items: [
                                                {
                                                    label: t`Edit Check-In List`,
                                                    icon: <IconPencil size={14}/>,
                                                    onClick: () => {
                                                        setSelectedCheckInListId(list.id as IdParam);
                                                        openEditModal();
                                                    }
                                                },
                                                {
                                                    label: t`Copy Check-In URL`,
                                                    icon: <IconCopy size={14}/>,
                                                    onClick: () => copyUrl(list),
                                                },
                                                {
                                                    label: t({message: 'Open Check-In Page', context: 'check-in list'}),
                                                    icon: <IconExternalLink size={14}/>,
                                                    onClick: () => openPage(list),
                                                }
                                            ],
                                        },
                                        {
                                            label: t`Danger zone`,
                                            items: [
                                                {
                                                    label: t`Delete Check-In List`,
                                                    icon: <IconTrash size={14}/>,
                                                    onClick: () => {
                                                        confirmationDialog(
                                                            t`Are you sure you would like to delete this Check-In List?`,
                                                            () => {
                                                                handleDeleteCheckInList(
                                                                    list.id as IdParam,
                                                                    eventId,
                                                                );
                                                            })
                                                    },
                                                    color: 'red',
                                                },
                                            ],
                                        },
                                    ]}
                                />
                            </div>
                        </article>
                    );
                })}
            </div>
            {(editModalOpen && selectedCheckInListId)
                && <EditCheckInListModal onClose={closeEditModal}
                                         checkInListId={selectedCheckInListId}/>}
        </>
    );
};
