import {ActionIcon, Anchor, Button, Popover, Tooltip, UnstyledButton, VisuallyHidden} from '@mantine/core';
import {Attendee, IdParam, MessageType} from "../../../types.ts";
import {
    IconCheck,
    IconCopy,
    IconDotsVertical,
    IconMailForward,
    IconNote,
    IconPlus,
    IconSend,
    IconTrash,
    IconUserCheck,
    IconUserCog,
} from "@tabler/icons-react";
import {getInitials, getProductFromEvent} from "../../../utilites/helpers.ts";
import {useClipboard, useDisclosure} from "@mantine/hooks";
import {SendMessageModal} from "../../modals/SendMessageModal";
import React, {useMemo, useState} from "react";
import {NoResultsSplash} from "../NoResultsSplash";
import {useParams} from "react-router";
import {useGetEvent} from "../../../queries/useGetEvent.ts";
import {useGetEventCheckInLists} from "../../../queries/useGetCheckInLists.ts";
import {useModifyAttendee} from "../../../mutations/useModifyAttendee.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {t} from "@lingui/macro";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {useResendAttendeeTicket} from "../../../mutations/useResendAttendeeTicket.ts";
import {ManageAttendeeModal} from "../../modals/ManageAttendeeModal";
import {BibNumber} from "../BibNumber";
import {ManageOrderModal} from "../../modals/ManageOrderModal";
import {ActionMenu} from '../ActionMenu';
import {CheckInStatusModal} from "../CheckInStatusModal";
import {prettyDate} from "../../../utilites/dates.ts";
import {TanStackTable, TanStackTableColumn} from "../TanStackTable";
import {ColumnVisibilityToggle} from "../ColumnVisibilityToggle";
import {CellContext} from "@tanstack/react-table";
import {AttendeeStatusBadge} from "../AttendeeStatusBadge";
import {PublicIcon} from "../PublicIcon";
import classes from './AttendeeTable.module.scss';

interface AttendeeTableProps {
    attendees: Attendee[];
    openCreateModal: () => void;
    // Above the list, on the left of the column toggle (the status chips of the attendees page).
    toolbar?: React.ReactNode;
}

const fullName = (attendee: Attendee) => `${attendee.first_name ?? ''} ${attendee.last_name ?? ''}`.trim();

// The attendees of an event, like the orders: initials, bold names, status tags and the check-in
// state as a pill that opens the detail per list; on phones each attendee is a line of a cream card.
export const AttendeeTable = ({attendees, openCreateModal, toolbar}: AttendeeTableProps) => {
    const {eventId} = useParams();
    const [isMessageModalOpen, messageModal] = useDisclosure(false);
    const [isViewModalOpen, viewModalOpen] = useDisclosure(false);
    const [isCheckInModalOpen, checkInModal] = useDisclosure(false);
    const [isOrderModalOpen, orderModal] = useDisclosure(false);
    const [emailPopoverId, setEmailPopoverId] = useState<number | null>(null);
    const [selectedAttendee, setSelectedAttendee] = useState<Attendee>();
    const [selectedOrderId, setSelectedOrderId] = useState<IdParam>();
    const {data: event} = useGetEvent(eventId);
    const {data: checkInLists} = useGetEventCheckInLists(eventId);
    const modifyMutation = useModifyAttendee();
    const resendTicketMutation = useResendAttendeeTicket();
    const clipboard = useClipboard({timeout: 2000});

    const hasCheckInLists = checkInLists?.data && checkInLists.data.length > 0;
    const totalLists = checkInLists?.data?.length || 0;

    const handleModalClick = (attendee: Attendee, modal: {
        open: () => void
    }) => {
        setSelectedAttendee(attendee);
        modal.open();
    }

    const handleResendTicket = (attendee: Attendee) => {
        resendTicketMutation.mutate({
            attendeeId: attendee.id,
            eventId: eventId,
        }, {
            onSuccess: () => showSuccess(t`Ticket email has been resent to attendee`),
            onError: (error: any) => showError(error.response.data.message || t`Failed to resend ticket email`)
        });
    }

    const handleCancel = (attendee: Attendee) => {
        const isCancelled = attendee.status === 'CANCELLED';
        const message = isCancelled
            ? t`Are you sure you want to activate this attendee?`
            : t`Are you sure you want to cancel this attendee? This will void their ticket`

        confirmationDialog(message, () => {
            modifyMutation.mutate({
                attendeeId: attendee.id,
                eventId: eventId,
                attendeeData: {
                    status: isCancelled ? 'ACTIVE' : 'CANCELLED'
                }
            }, {
                onSuccess: () => showSuccess(isCancelled ? t`Ticket reactivated` : t`Ticket cancelled`),
                onError: () => showError(t`Failed to cancel attendee`),
            });
        })
    };

    const handleCopyEmail = (email: string) => {
        clipboard.copy(email);
        showSuccess(t`Email address copied to clipboard`);
        setEmailPopoverId(null);
    };

    const handleMessageFromEmail = (attendee: Attendee) => {
        setEmailPopoverId(null);
        handleModalClick(attendee, messageModal);
    };

    const handleOrderClick = (orderId: IdParam) => {
        setSelectedOrderId(orderId);
        orderModal.open();
    };

    const ticketTitle = (attendee: Attendee) => getProductFromEvent(attendee.product_id, event)?.title;

    // Checked in on at least one list: green with the count, otherwise an outlined pill.
    const checkInButton = (attendee: Attendee) => {
        const checkInCount = attendee.check_ins?.length || 0;

        return (
            <UnstyledButton
                className={classes.checkInButton}
                data-checked-in={checkInCount > 0 || undefined}
                onClick={() => handleModalClick(attendee, checkInModal)}
            >
                {checkInCount > 0 ? (
                    <>
                        <IconCheck size={16} stroke={2.5}/>
                        {t({message: 'Checked in', context: 'attendee check-in'})}
                        <span className={classes.checkInCount}>{checkInCount}/{totalLists}</span>
                    </>
                ) : (
                    <>
                        <PublicIcon name="qr" size={16}/>
                        {t({message: 'Not checked in', context: 'attendee check-in'})}
                    </>
                )}
            </UnstyledButton>
        );
    };

    const actionMenu = (attendee: Attendee) => (
        <ActionMenu
            target={(
                <ActionIcon className={classes.menuButton} variant="subtle" aria-label={t`Actions`}>
                    <IconDotsVertical size={20}/>
                </ActionIcon>
            )}
            itemsGroups={[
                {
                    label: t`Actions`,
                    items: [
                        {
                            label: t`Manage attendee`,
                            icon: <IconUserCog size={14}/>,
                            onClick: () => handleModalClick(attendee, viewModalOpen),
                        },
                        {
                            label: t`Message attendee`,
                            icon: <IconSend size={14}/>,
                            onClick: () => handleModalClick(attendee, messageModal),
                        },
                        {
                            label: t`Resend ticket email`,
                            icon: <IconMailForward size={14}/>,
                            onClick: () => handleResendTicket(attendee),
                            visible: attendee.status === 'ACTIVE',
                        },
                    ],
                },
                {
                    label: t`Danger zone`,
                    items: [
                        attendee.status === 'CANCELLED' ? {
                            label: t`Reactivate ticket`,
                            icon: <IconUserCheck size={14}/>,
                            onClick: () => handleCancel(attendee),
                        } : {
                            label: t`Cancel ticket`,
                            icon: <IconTrash size={14}/>,
                            onClick: () => handleCancel(attendee),
                            color: 'red',
                        },
                    ],
                },
            ]}
        />
    );

    const renderMobileRow = (attendee: Attendee) => {
        const ticket = ticketTitle(attendee);

        return (
            <div className={classes.mobileAttendee}>
                <span className={classes.avatar} aria-hidden>{getInitials(fullName(attendee) || '?')}</span>
                <UnstyledButton className={classes.mobileHead} onClick={() => handleModalClick(attendee, viewModalOpen)}>
                    <span className={classes.mobileName}>
                        {fullName(attendee)}
                    </span>
                    <span className={classes.mobileMeta}>
                        {[ticket, attendee.order?.public_id && `#${attendee.order.public_id}`].filter(Boolean).join(' · ')}
                    </span>
                </UnstyledButton>
                <div className={classes.mobileMenu}>{actionMenu(attendee)}</div>
                <div className={classes.mobileFoot}>
                    <AttendeeStatusBadge attendee={attendee}/>
                    <BibNumber bibNumber={attendee.bib_number} size="sm"/>
                    {hasCheckInLists && checkInButton(attendee)}
                </div>
            </div>
        );
    };

    const columns = useMemo<TanStackTableColumn<Attendee>[]>(
        () => {
            const allColumns: TanStackTableColumn<Attendee>[] = [
                {
                    id: 'attendeeDetails',
                    header: t`Attendee`,
                    enableHiding: false,
                    cell: (info: CellContext<Attendee, unknown>) => {
                        const attendee = info.row.original;
                        return (
                            <div className={classes.attendee}>
                                <span className={classes.avatar} aria-hidden>
                                    {getInitials(fullName(attendee) || '?')}
                                </span>
                                <div className={classes.attendeeDetails}>
                                    <div className={classes.nameRow}>
                                        <Anchor
                                            component="button"
                                            type="button"
                                            className={classes.attendeeName}
                                            onClick={() => handleModalClick(attendee, viewModalOpen)}
                                        >
                                            {fullName(attendee)}
                                        </Anchor>
                                        <BibNumber bibNumber={attendee.bib_number} size="xs"/>
                                    </div>
                                    <div className={classes.emailRow}>
                                        <Popover
                                            opened={emailPopoverId === attendee.id}
                                            onChange={(opened) => {
                                                if (!opened) setEmailPopoverId(null);
                                            }}
                                            width={200}
                                            position="bottom"
                                            withArrow
                                            shadow="md"
                                        >
                                            <Popover.Target>
                                                <Anchor
                                                    component="button"
                                                    type="button"
                                                    onClick={() => setEmailPopoverId(attendee.id || null)}
                                                    className={classes.attendeeEmail}
                                                >
                                                    {attendee.email}
                                                </Anchor>
                                            </Popover.Target>
                                            <Popover.Dropdown className={classes.emailDropdown}>
                                                <UnstyledButton className={classes.emailAction}
                                                                onClick={() => handleMessageFromEmail(attendee)}>
                                                    <IconSend size={18}/>
                                                    {t`Message`}
                                                </UnstyledButton>
                                                <UnstyledButton className={classes.emailAction}
                                                                onClick={() => handleCopyEmail(attendee.email)}>
                                                    <IconCopy size={18}/>
                                                    {t`Copy Email`}
                                                </UnstyledButton>
                                            </Popover.Dropdown>
                                        </Popover>
                                        {attendee.notes && (
                                            <Tooltip
                                                label={attendee.notes.length > 100 ? t`Click to view notes` : attendee.notes}
                                                multiline
                                                w={attendee.notes.length > 100 ? 'auto' : 300}
                                                withArrow
                                            >
                                                <ActionIcon
                                                    className={classes.noteButton}
                                                    size="sm"
                                                    variant="subtle"
                                                    aria-label={t`Notes`}
                                                    onClick={() => handleModalClick(attendee, viewModalOpen)}
                                                >
                                                    <IconNote size={16}/>
                                                </ActionIcon>
                                            </Tooltip>
                                        )}
                                    </div>
                                    <span className={classes.publicId}>{attendee.public_id}</span>
                                </div>
                            </div>
                        );
                    },
                    meta: {
                        headerStyle: {minWidth: 280},
                    },
                },
                {
                    id: 'orderAndTicket',
                    header: t`Order & Ticket`,
                    enableHiding: true,
                    cell: (info: CellContext<Attendee, unknown>) => {
                        const attendee = info.row.original;
                        return (
                            <div className={classes.orderTicket}>
                                <span className={classes.ticketName}>
                                    <PublicIcon name="billet" size={16}/>
                                    <span>{ticketTitle(attendee)}</span>
                                </span>
                                {attendee.order?.public_id && (
                                    <Anchor
                                        component="button"
                                        type="button"
                                        onClick={() => handleOrderClick(attendee.order_id)}
                                        className={classes.orderId}
                                    >
                                        #{attendee.order.public_id}
                                    </Anchor>
                                )}
                                {attendee.order?.created_at && event?.timezone && (
                                    <span className={classes.registrationDate}>
                                        {prettyDate(attendee.order.created_at, event.timezone)}
                                    </span>
                                )}
                            </div>
                        );
                    },
                    meta: {
                        headerStyle: {minWidth: 180},
                    },
                },
                {
                    id: 'status',
                    header: t`Status`,
                    enableHiding: true,
                    cell: (info: CellContext<Attendee, unknown>) => <AttendeeStatusBadge attendee={info.row.original}/>,
                },
                {
                    id: 'checkIn',
                    header: t`Check-in`,
                    enableHiding: true,
                    cell: (info: CellContext<Attendee, unknown>) => checkInButton(info.row.original),
                },
                {
                    id: 'actions',
                    header: () => <VisuallyHidden>{t`Actions`}</VisuallyHidden>,
                    enableHiding: false,
                    cell: (info: CellContext<Attendee, unknown>) => (
                        <div className={classes.actionsMenu}>
                            {actionMenu(info.row.original)}
                        </div>
                    ),
                    meta: {
                        sticky: 'right',
                    },
                },
            ];

            return allColumns.filter(column => column.id !== 'checkIn' || hasCheckInLists);
        },
        [emailPopoverId, event, hasCheckInLists, totalLists]
    );

    if (attendees.length === 0) {
        return (
            <>
                {toolbar && <div className={classes.emptyToolbar}>{toolbar}</div>}
                <NoResultsSplash
                    heading={t`No Attendees to show`}
                    icon="billet"
                    subHeading={(
                        <p>
                            {t`Your attendees will appear here once they have registered for your event. You can also manually add attendees.`}
                        </p>
                    )}
                >
                    <Button leftSection={<IconPlus size={20}/>} onClick={() => openCreateModal()}>
                        {t`Add an attendee`}
                    </Button>
                </NoResultsSplash>
            </>
        );
    }

    return (
        <>
            <TanStackTable
                data={attendees}
                columns={columns}
                storageKey="attendee-table"
                enableColumnVisibility={true}
                renderColumnVisibilityToggle={(table) => <ColumnVisibilityToggle table={table}/>}
                renderMobileRow={renderMobileRow}
                toolbarStart={toolbar}
            />
            {(selectedAttendee && isMessageModalOpen) && <SendMessageModal
                onClose={messageModal.close}
                orderId={selectedAttendee.order_id}
                attendeeId={selectedAttendee.id}
                messageType={MessageType.IndividualAttendees}
            />}
            {(selectedAttendee?.id && isViewModalOpen) && <ManageAttendeeModal
                attendeeId={selectedAttendee.id}
                onClose={viewModalOpen.close}
            />}
            {(selectedAttendee && isCheckInModalOpen && event?.timezone) && <CheckInStatusModal
                attendee={selectedAttendee}
                eventTimezone={event.timezone}
                eventId={eventId}
                isOpen={isCheckInModalOpen}
                onClose={checkInModal.close}
            />}
            {(selectedOrderId && isOrderModalOpen) && <ManageOrderModal
                orderId={selectedOrderId}
                onClose={orderModal.close}
            />}
        </>
    );
};
