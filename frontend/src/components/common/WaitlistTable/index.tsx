import {t} from "@lingui/macro";
import {ActionIcon, Menu, VisuallyHidden} from "@mantine/core";
import {IconDotsVertical, IconEye, IconSend, IconTrash} from "@tabler/icons-react";
import React, {useMemo, useState} from "react";
import {CellContext} from "@tanstack/react-table";
import {useDisclosure} from "@mantine/hooks";
import {IdParam, WaitlistEntry, WaitlistEntryStatus} from "../../../types.ts";
import {relativeDate} from "../../../utilites/dates.ts";
import {NoResultsSplash} from "../NoResultsSplash";
import {confirmationDialog} from "../../../utilites/confirmationDialog.tsx";
import {useRemoveWaitlistEntry} from "../../../mutations/useRemoveWaitlistEntry.ts";
import {useOfferSpecificWaitlistEntry} from "../../../mutations/useOfferSpecificWaitlistEntry.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {TanStackTable, TanStackTableColumn} from "../TanStackTable";
import {ManageOrderModal} from "../../modals/ManageOrderModal";
import {StatusTag, StatusTone} from "../StatusTag";
import {getInitials} from "../../../utilites/helpers.ts";
import classes from './WaitlistTable.module.scss';

interface WaitlistTableProps {
    eventId: IdParam;
    entries: WaitlistEntry[];
    // Above the list (the status chips of the waitlist page).
    toolbar?: React.ReactNode;
}

// Waiting: in line; offered: their turn, the offer runs out; purchased: done.
const statusMap: Record<string, () => { label: string, tone: StatusTone }> = {
    [WaitlistEntryStatus.Waiting]: () => ({label: t`Waiting`, tone: 'neutral'}),
    [WaitlistEntryStatus.Offered]: () => ({label: t`Offered`, tone: 'waiting'}),
    [WaitlistEntryStatus.Purchased]: () => ({label: t`Purchased`, tone: 'ok'}),
    [WaitlistEntryStatus.Cancelled]: () => ({label: t`Cancelled`, tone: 'neutral'}),
    [WaitlistEntryStatus.OfferExpired]: () => ({label: t`Expired`, tone: 'problem'}),
};

const entryStatus = (entry: WaitlistEntry) => entry.status && statusMap[entry.status]
    ? statusMap[entry.status]()
    : {label: entry.status ?? '', tone: 'neutral' as StatusTone};

const entryName = (entry: WaitlistEntry) => `${entry.first_name ?? ''} ${entry.last_name ?? ''}`.trim();

const productLabel = (entry: WaitlistEntry) => {
    const title = entry.product?.title || '';
    const label = entry.product_price?.label;
    return label ? `${title} - ${label}` : title;
};

const ActionMenu = ({entry, onOffer, onRemove, onViewOrder}: {
    entry: WaitlistEntry;
    onOffer: (entryId: IdParam) => void;
    onRemove: (entryId: number) => void;
    onViewOrder: (orderId: IdParam) => void;
}) => {
    const isWaiting = entry.status === WaitlistEntryStatus.Waiting;
    const isOffered = entry.status === WaitlistEntryStatus.Offered;
    const isExpired = entry.status === WaitlistEntryStatus.OfferExpired;
    const isPurchased = entry.status === WaitlistEntryStatus.Purchased;
    const canOffer = isWaiting || isExpired;
    const canCancel = isWaiting || isOffered;

    if (!(isPurchased && entry.order_id) && !canOffer && !canCancel) {
        return null;
    }

    return (
        <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
                <ActionIcon className={classes.menuButton} variant="subtle" aria-label={t`Actions`}>
                    <IconDotsVertical size={20}/>
                </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Label>{t`Actions`}</Menu.Label>
                {isPurchased && entry.order_id && (
                    <Menu.Item
                        leftSection={<IconEye size={14}/>}
                        onClick={() => onViewOrder(entry.order_id!)}
                    >
                        {t`View Order`}
                    </Menu.Item>
                )}
                {canOffer && (
                    <Menu.Item
                        leftSection={<IconSend size={14}/>}
                        onClick={() => onOffer(entry.id)}
                    >
                        {isExpired ? t`Re-offer Spot` : t`Offer Spot`}
                    </Menu.Item>
                )}
                {canCancel && (
                    <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={14}/>}
                        onClick={() => onRemove(entry.id as number)}
                    >
                        {isOffered ? t`Revoke Offer` : t`Remove`}
                    </Menu.Item>
                )}
            </Menu.Dropdown>
        </Menu>
    );
};

// The waitlist in line order, like the orders table; on phones each entry is a line of a cream card.
export const WaitlistTable = ({eventId, entries, toolbar}: WaitlistTableProps) => {
    const removeMutation = useRemoveWaitlistEntry();
    const offerMutation = useOfferSpecificWaitlistEntry();
    const [isOrderModalOpen, orderModal] = useDisclosure(false);
    const [selectedOrderId, setSelectedOrderId] = useState<IdParam>();

    const handleViewOrder = (orderId: IdParam) => {
        setSelectedOrderId(orderId);
        orderModal.open();
    };

    const handleRemove = (entryId: number) => {
        confirmationDialog(
            t`Are you sure you want to remove this entry from the waitlist?`,
            () => {
                removeMutation.mutate({eventId, entryId}, {
                    onSuccess: () => {
                        showSuccess(t`Successfully removed from waitlist`);
                    },
                    onError: () => {
                        showError(t`Failed to remove from waitlist`);
                    },
                });
            },
            {confirm: t`Remove`, cancel: t`Cancel`}
        );
    };

    const handleOffer = (entryId: IdParam) => {
        confirmationDialog(
            t`Are you sure you want to offer a spot to this person? They will receive an email notification.`,
            () => {
                offerMutation.mutate({eventId, entryId}, {
                    onSuccess: () => {
                        showSuccess(t`Successfully offered a spot`);
                    },
                    onError: (error: any) => {
                        const errors = error?.response?.data?.errors;
                        const message = errors
                            ? Object.values(errors).flat().join(', ')
                            : t`Failed to offer spot`;
                        showError(message as string);
                    },
                });
            },
            {confirm: t`Offer`, cancel: t`Cancel`}
        );
    };

    const actionMenu = (entry: WaitlistEntry) => (
        <ActionMenu
            entry={entry}
            onOffer={handleOffer}
            onRemove={handleRemove}
            onViewOrder={handleViewOrder}
        />
    );

    const renderMobileRow = (entry: WaitlistEntry) => {
        const status = entryStatus(entry);

        return (
            <div className={classes.mobileEntry}>
                <span className={classes.position}>{entry.position}</span>
                <div className={classes.mobileHead}>
                    <span className={classes.mobileName}>{entryName(entry)}</span>
                    <span className={classes.mobileMeta}>{entry.email}</span>
                </div>
                <div className={classes.mobileMenu}>{actionMenu(entry)}</div>
                <div className={classes.mobileFoot}>
                    <span className={classes.mobileMeta}>
                        {[productLabel(entry), entry.created_at && relativeDate(String(entry.created_at))]
                            .filter(Boolean).join(' · ')}
                    </span>
                    <StatusTag tone={status.tone}>{status.label}</StatusTag>
                </div>
            </div>
        );
    };

    const columns = useMemo<TanStackTableColumn<WaitlistEntry>[]>(
        () => [
            {
                id: 'position',
                header: '#',
                enableHiding: false,
                cell: (info: CellContext<WaitlistEntry, unknown>) => (
                    <span className={classes.position}>{info.row.original.position}</span>
                ),
                meta: {
                    headerStyle: {width: 64},
                },
            },
            {
                id: 'contact',
                header: t`Contact`,
                enableHiding: false,
                cell: (info: CellContext<WaitlistEntry, unknown>) => {
                    const entry = info.row.original;
                    return (
                        <div className={classes.contact}>
                            <span className={classes.avatar} aria-hidden>{getInitials(entryName(entry) || '?')}</span>
                            <div className={classes.contactDetails}>
                                <span className={classes.contactName}>{entryName(entry)}</span>
                                <span className={classes.contactEmail}>{entry.email}</span>
                            </div>
                        </div>
                    );
                },
                meta: {
                    headerStyle: {minWidth: 240},
                },
            },
            {
                id: 'product',
                header: t`Product`,
                enableHiding: true,
                cell: (info: CellContext<WaitlistEntry, unknown>) => (
                    <span className={classes.product}>{productLabel(info.row.original)}</span>
                ),
            },
            {
                id: 'status',
                header: t`Status`,
                enableHiding: true,
                cell: (info: CellContext<WaitlistEntry, unknown>) => {
                    const status = entryStatus(info.row.original);
                    return <StatusTag tone={status.tone}>{status.label}</StatusTag>;
                },
            },
            {
                id: 'joined',
                header: t`Joined`,
                enableHiding: true,
                cell: (info: CellContext<WaitlistEntry, unknown>) => {
                    const entry = info.row.original;
                    return (
                        <span className={classes.joined}>
                            {entry.created_at ? relativeDate(String(entry.created_at)) : ''}
                        </span>
                    );
                },
            },
            {
                id: 'actions',
                header: () => <VisuallyHidden>{t`Actions`}</VisuallyHidden>,
                enableHiding: false,
                cell: (info: CellContext<WaitlistEntry, unknown>) => (
                    <div className={classes.actionsMenu}>
                        {actionMenu(info.row.original)}
                    </div>
                ),
                meta: {
                    sticky: 'right',
                },
            },
        ],
        [eventId]
    );

    if (entries.length === 0) {
        return (
            <>
                {toolbar && <div className={classes.emptyToolbar}>{toolbar}</div>}
                <NoResultsSplash
                    heading={t`No waitlist entries`}
                    icon="horloge"
                    subHeading={(
                        <p>
                            {t`Entries will appear here when customers join the waitlist for sold out products.`}
                        </p>
                    )}
                />
            </>
        );
    }

    return (
        <>
            <TanStackTable
                data={entries}
                columns={columns}
                renderMobileRow={renderMobileRow}
                toolbarStart={toolbar}
            />
            {(selectedOrderId && isOrderModalOpen) && (
                <ManageOrderModal
                    orderId={selectedOrderId}
                    onClose={orderModal.close}
                />
            )}
        </>
    );
};
