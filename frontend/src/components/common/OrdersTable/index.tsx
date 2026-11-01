import {t} from "@lingui/macro";
import {ActionIcon, Anchor, Group, Menu, Popover, Text, Tooltip, UnstyledButton, VisuallyHidden} from '@mantine/core';
import {DonationReceipt, Event, IdParam, Invoice, MessageType, Order, ProductPriceType} from "../../../types.ts";
import {
    IconBasketCog,
    IconCash,
    IconClock,
    IconCopy,
    IconCreditCard,
    IconDotsVertical,
    IconFileInvoice,
    IconFileOff,
    IconHelp,
    IconReceipt2,
    IconReceiptDollar,
    IconReceiptRefund,
    IconRepeat,
    IconSend,
    IconTrash,
} from "@tabler/icons-react";
import {relativeDate} from "../../../utilites/dates.ts";
import {ManageOrderModal} from "../../modals/ManageOrderModal";
import {useClipboard, useDisclosure} from "@mantine/hooks";
import React, {useMemo, useState} from "react";
import {CancelOrderModal} from "../../modals/CancelOrderModal";
import {SendMessageModal} from "../../modals/SendMessageModal";
import {NoResultsSplash} from "../NoResultsSplash";
import {RefundOrderModal} from "../../modals/RefundOrderModal";
import classes from "./OrdersTable.module.scss";
import {useResendOrderConfirmation} from "../../../mutations/useResendOrderConfirmation.ts";
import {formatNumber, getInitials, getProductsFromEvent} from "../../../utilites/helpers.ts";
import {useUrlHash} from "../../../hooks/useUrlHash.ts";
import {useMarkOrderAsPaid} from "../../../mutations/useMarkOrderAsPaid.ts";
import {orderClient} from "../../../api/order.client.ts";
import {downloadBinary} from "../../../utilites/download.ts";
import {withLoadingNotification} from "../../../utilites/withLoadingNotification.tsx";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {TanStackTable, TanStackTableColumn} from "../TanStackTable";
import {ColumnVisibilityToggle} from "../ColumnVisibilityToggle";
import {CellContext} from "@tanstack/react-table";
import {formatCurrency} from "../../../utilites/currency.ts";
import {eventCheckoutUrl} from "../../../utilites/urlHelper.ts";
import {StatusTag, StatusTone} from "../StatusTag";
import {intlLocale} from "../../../utilites/intlLocale.ts";
import {PublicIcon} from "../PublicIcon";

interface OrdersTableProps {
    event: Event,
    orders: Order[];
    // Above the list, on the left of the column toggle (the status chips of the orders page).
    toolbar?: React.ReactNode;
}

const orderStatus = (status: Order['status']): { label: string, tone: StatusTone } => {
    switch (status) {
        case 'COMPLETED':
            return {label: t`Completed`, tone: 'ok'};
        case 'RESERVED':
            return {label: t`Reserved`, tone: 'waiting'};
        case 'AWAITING_OFFLINE_PAYMENT':
            return {label: t`Awaiting Payment`, tone: 'waiting'};
        case 'CANCELLED':
            return {label: t`Cancelled`, tone: 'neutral'};
        case 'ABANDONED':
            return {label: t`Abandoned`, tone: 'neutral'};
        default:
            return {label: String(status), tone: 'neutral'};
    }
};

const customerName = (order: Order) => `${order.first_name ?? ''} ${order.last_name ?? ''}`.trim();

const itemCount = (order: Order) => order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

// The orders of an event, like « Commandes récentes » on the dashboard: initials, bold amounts and
// status tags; on phones each order is a line of a cream card (name, number, amount, status, menu).
export const OrdersTable = ({orders, event, toolbar}: OrdersTableProps) => {
    const [isViewModalOpen, viewModal] = useDisclosure(false);
    const [isCancelModalOpen, cancelModal] = useDisclosure(false);
    const [isMessageModalOpen, messageModal] = useDisclosure(false);
    const [isRefundModalOpen, refundModal] = useDisclosure(false);
    const [orderId, setOrderId] = useState<IdParam>();
    const [emailPopoverId, setEmailPopoverId] = useState<IdParam | null>(null);
    const resendConfirmationMutation = useResendOrderConfirmation();
    const markAsPaidMutation = useMarkOrderAsPaid();
    const clipboard = useClipboard({timeout: 2000});

    useUrlHash(/^#order-(\d+)$/, (matches => {
        const orderId = matches![1];
        setOrderId(orderId);
        viewModal.open();
    }));

    const handleModalClick = (orderId: IdParam, modal: { open: () => void }) => {
        setOrderId(orderId);
        modal.open();
    }

    const handleMarkAsPaid = (eventId: IdParam, orderId: IdParam) => {
        markAsPaidMutation.mutate({eventId, orderId}, {
            onSuccess: () => showSuccess(t`Order marked as paid`),
            onError: () => showError(t`There was an error marking the order as paid`)
        });
    }

    const handleResendConfirmation = (eventId: IdParam, orderId: IdParam) => {
        resendConfirmationMutation.mutate({eventId, orderId}, {
            onSuccess: () => showSuccess(t`Your message has been sent`),
            onError: () => showError(t`There was an error sending your message`)
        });
    }

    const handleInvoiceDownload = async (invoice: Invoice) => {
        await withLoadingNotification(
            async () => {
                const blob = await orderClient.downloadInvoice(event.id, invoice.order_id);
                downloadBinary(blob, invoice.invoice_number + '.pdf');
            },
            {
                loading: {
                    title: t`Downloading Invoice`,
                    message: t`Please wait while we prepare your invoice...`
                },
                success: {
                    title: t`Success`,
                    message: t`Invoice downloaded successfully`
                },
                error: {
                    title: t`Error`,
                    message: t`Failed to download invoice. Please try again.`
                }
            }
        );
    };

    const handleDonationReceiptDownload = async (receipt: DonationReceipt) => {
        await withLoadingNotification(
            async () => {
                const blob = await orderClient.downloadDonationReceipt(event.id, receipt.order_id);
                downloadBinary(blob, 'recu-' + receipt.receipt_number + '.pdf');
            },
            {
                loading: {
                    title: t`Downloading receipt`,
                    message: t`Please wait while we prepare the tax receipt...`
                },
                success: {
                    title: t`Success`,
                    message: t`Tax receipt downloaded successfully`
                },
                error: {
                    title: t`Error`,
                    message: t`Failed to download the tax receipt. Please try again.`
                }
            }
        );
    };

    const handleCopyEmail = (email: string) => {
        clipboard.copy(email);
        showSuccess(t`Email address copied to clipboard`);
        setEmailPopoverId(null);
    };

    const handleMessageFromEmail = (order: Order) => {
        setEmailPopoverId(null);
        handleModalClick(order.id, messageModal);
    };

    const formatTime = (dateString: string): string => {
        return new Date(dateString).toLocaleTimeString(intlLocale(), {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const renderActionMenu = (order: Order) => {
        const isRefundable = !order.is_free_order
            && order.status !== 'AWAITING_OFFLINE_PAYMENT'
            && order.payment_provider === 'STRIPE'
            && order.refund_status !== 'REFUNDED';

        return (
            <Group wrap={'nowrap'} gap={0} justify={'flex-end'}>
                <Menu shadow="md" width={270} position="bottom-end">
                    <Menu.Target>
                        <ActionIcon className={classes.menuButton} variant="subtle" aria-label={t`Actions`}>
                            <IconDotsVertical size={20}/>
                        </ActionIcon>
                    </Menu.Target>

                    <Menu.Dropdown>
                        <Menu.Label>{t`Manage`}</Menu.Label>
                        <Menu.Item onClick={() => handleModalClick(order.id, viewModal)}
                                   leftSection={<IconBasketCog size={14}/>}>{t`Manage order`}</Menu.Item>
                        <Menu.Item onClick={() => handleModalClick(order.id, messageModal)}
                                   leftSection={<IconSend size={14}/>}>{t`Message buyer`}</Menu.Item>
                        <Menu.Item onClick={() => {
                                       const url = eventCheckoutUrl(order.event_id, order.short_id, 'summary');
                                       clipboard.copy(url);
                                       showSuccess(t`Customer link copied to clipboard`);
                                   }}
                                   leftSection={<IconCopy size={14}/>}>{t`Copy customer link`}</Menu.Item>

                        {order.latest_invoice && (
                            <Menu.Item onClick={() => handleInvoiceDownload(order.latest_invoice as Invoice)}
                                       leftSection={<IconReceipt2 size={14}/>}>{t`Download invoice`}</Menu.Item>
                        )}

                        {order.donation_receipt && (
                            <Menu.Item onClick={() => handleDonationReceiptDownload(order.donation_receipt as DonationReceipt)}
                                       leftSection={<IconReceipt2 size={14}/>}>{t`Download tax receipt`}</Menu.Item>
                        )}

                        {order.status === 'AWAITING_OFFLINE_PAYMENT' && (
                            <Menu.Item onClick={() => handleMarkAsPaid(event.id, order.id)}
                                       leftSection={<IconReceiptDollar size={14}/>}>{t`Mark as paid`}</Menu.Item>
                        )}

                        {isRefundable && (
                            <Menu.Item onClick={() => handleModalClick(order.id, refundModal)}
                                       leftSection={<IconReceiptRefund size={14}/>}>{t`Refund order`}</Menu.Item>
                        )}

                        {order.status === 'COMPLETED' && (
                            <Menu.Item
                                onClick={() => handleResendConfirmation(event.id, order.id)}
                                leftSection={<IconRepeat size={14}/>}>
                                {t`Resend order email`}
                            </Menu.Item>
                        )}

                        {order.status !== 'CANCELLED' && (
                            <>
                                <Menu.Divider/>
                                <Menu.Label>{t`Danger zone`}</Menu.Label>
                                <Menu.Item color="red"
                                           onClick={() => handleModalClick(order.id, cancelModal)}
                                           leftSection={<IconTrash size={14}/>}>
                                    {t`Cancel order`}
                                </Menu.Item>
                            </>
                        )}
                    </Menu.Dropdown>
                </Menu>
            </Group>
        );
    }

    // Meme regle que DonationBreakdownService: un produit DONATION compte en
    // entier, un billet-benefice seulement pour sa part charity_amount.
    const productsById = useMemo(
        () => new Map((getProductsFromEvent(event) ?? []).map(product => [product.id, product])),
        [event],
    );

    const donationAmount = (order: Order): number => (order.order_items ?? []).reduce((total, item) => {
        const product = productsById.get(item.product_id);
        if (!product) {
            return total;
        }
        if (product.type === ProductPriceType.Donation) {
            return total + item.price * item.quantity;
        }
        if (product.charity_amount && product.charity_amount > 0) {
            return total + Math.min(product.charity_amount, item.price) * item.quantity;
        }
        return total;
    }, 0);

    const paymentLabel = (order: Order) => {
        if (order.payment_provider === 'STRIPE') {
            return <><IconCreditCard size={18}/>{t`Stripe`}</>;
        }
        if (order.payment_provider === 'OFFLINE') {
            return <><IconCash size={18}/>{t`Offline`}</>;
        }
        return <><IconHelp size={18}/>{t`Other`}</>;
    };

    const refundLine = (order: Order) => {
        if (!order.refund_status) {
            return null;
        }

        return (
            <Text className={classes.refundedAmount} data-refund-status={order.refund_status}>
                {order.refund_status === 'REFUNDED' && t`Refunded: ${formatCurrency(order.total_refunded, order.currency)}`}
                {order.refund_status === 'PARTIALLY_REFUNDED' && t`Partially refunded: ${formatCurrency(order.total_refunded, order.currency)}`}
                {order.refund_status === 'REFUND_PENDING' && t`Refund pending`}
                {order.refund_status === 'REFUND_FAILED' && t`Refund failed`}
            </Text>
        );
    };

    const renderMobileRow = (order: Order) => {
        const status = orderStatus(order.status);

        return (
            <div className={classes.mobileOrder}>
                <span className={classes.avatar} aria-hidden>{getInitials(customerName(order) || '?')}</span>
                <UnstyledButton className={classes.mobileHead} onClick={() => handleModalClick(order.id, viewModal)}>
                    <span className={classes.mobileName}>{customerName(order)}</span>
                    <span className={classes.mobileMeta}>
                        #{order.public_id} · {relativeDate(order.created_at)}
                    </span>
                </UnstyledButton>
                <div className={classes.mobileMenu}>{renderActionMenu(order)}</div>
                <div className={classes.mobileFoot}>
                    <span className={classes.mobileAmount}>
                        <strong>{formatCurrency(order.total_gross, order.currency)}</strong>
                        <span>{formatNumber(itemCount(order))} {t`item(s)`}</span>
                    </span>
                    <StatusTag tone={status.tone}>{status.label}</StatusTag>
                </div>
                {order.refund_status && <div className={classes.mobileExtra}>{refundLine(order)}</div>}
            </div>
        );
    };

    const columns = useMemo<TanStackTableColumn<Order>[]>(
        () => [
            {
                id: 'customer',
                header: t`Customer`,
                enableHiding: false,
                cell: (info: CellContext<Order, unknown>) => {
                    const order = info.row.original;
                    return (
                        <div className={classes.customer}>
                            <span className={classes.avatar} aria-hidden>{getInitials(customerName(order) || '?')}</span>
                            <div className={classes.customerDetails}>
                            <div className={classes.nameRow}>
                                <Anchor
                                    component="button"
                                    type="button"
                                    onClick={() => handleModalClick(order.id, viewModal)}
                                    className={classes.customerName}
                                >
                                    {customerName(order)}
                                </Anchor>
                                {order.company_name && (
                                    <Text className={classes.companyName}>
                                        {order.company_name}
                                    </Text>
                                )}
                            </div>
                            <Popover
                                opened={emailPopoverId === order.id}
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
                                        onClick={() => setEmailPopoverId(order.id)}
                                        className={classes.customerEmail}
                                    >
                                        {order.email}
                                    </Anchor>
                                </Popover.Target>
                                <Popover.Dropdown className={classes.emailDropdown}>
                                    <UnstyledButton className={classes.emailAction}
                                                    onClick={() => handleMessageFromEmail(order)}>
                                        <IconSend size={18}/>
                                        {t`Message`}
                                    </UnstyledButton>
                                    <UnstyledButton className={classes.emailAction}
                                                    onClick={() => handleCopyEmail(order.email)}>
                                        <IconCopy size={18}/>
                                        {t`Copy Email`}
                                    </UnstyledButton>
                                </Popover.Dropdown>
                            </Popover>
                            </div>
                        </div>
                    );
                },
                meta: {
                    headerStyle: {minWidth: 200},
                },
            },
            {
                id: 'orderDetails',
                header: t`Order Details`,
                enableHiding: true,
                cell: (info: CellContext<Order, unknown>) => {
                    const order = info.row.original;
                    return (
                        <div className={classes.orderDetails}>
                            <Anchor
                                component="button"
                                type="button"
                                onClick={() => handleModalClick(order.id, viewModal)}
                                className={classes.orderId}
                            >
                                #{order.public_id}
                            </Anchor>
                            <div className={classes.orderMeta}>
                                <Text className={classes.createdDate}>
                                    {relativeDate(order.created_at)}
                                </Text>
                                {order.latest_invoice ? (
                                    <Anchor
                                        component="button"
                                        type="button"
                                        onClick={() => handleInvoiceDownload(order.latest_invoice as Invoice)}
                                        className={classes.invoiceLink}
                                    >
                                        <IconFileInvoice size={14}/>
                                        {t`Invoice`} #{order.latest_invoice.invoice_number}
                                    </Anchor>
                                ) : (
                                    <Text className={classes.noInvoice}>
                                        <IconFileOff size={14}/>
                                        {t`No invoice`}
                                    </Text>
                                )}
                                {order.status === 'RESERVED' && order.reserved_until && (
                                    <Text className={classes.reservedUntil}>
                                        <IconClock size={14}/>
                                        {t`Reserved until`} {formatTime(order.reserved_until)}
                                    </Text>
                                )}
                            </div>
                        </div>
                    );
                },
            },
            {
                id: 'items',
                header: t`Items`,
                enableHiding: true,
                cell: (info: CellContext<Order, unknown>) => {
                    const order = info.row.original;
                    const itemBreakdown = order.order_items?.map(item =>
                        `${item.quantity}x ${item.item_name}`
                    ).join('\n') || '';

                    return (
                        <Tooltip
                            label={itemBreakdown}
                            multiline
                            withArrow
                            disabled={!itemBreakdown}
                        >
                            <span className={classes.itemsBadge}>
                                <PublicIcon name="billet" size={16}/>
                                {formatNumber(itemCount(order))} {t`item(s)`}
                            </span>
                        </Tooltip>
                    );
                },
            },
            {
                id: 'amount',
                header: t`Amount`,
                enableHiding: true,
                cell: (info: CellContext<Order, unknown>) => {
                    const order = info.row.original;
                    return (
                        <div className={classes.amountDetails}>
                            <Text className={classes.amountGross}>
                                {formatCurrency(order.total_gross, order.currency)}
                            </Text>
                            <Text className={classes.amountBreakdown}>
                                <span>{t`Tax`}: {formatCurrency(order.total_tax, order.currency)}</span>
                                <span>{t`Fees`}: {formatCurrency(order.total_fee, order.currency)}</span>
                                {donationAmount(order) > 0 && (
                                    <span>{t`Donation`}: {formatCurrency(donationAmount(order), order.currency)}</span>
                                )}
                            </Text>
                            {order.donation_receipt && (
                                <Text className={classes.amountBreakdown}>
                                    {t`Receipt #${order.donation_receipt.receipt_number}`}
                                </Text>
                            )}
                            {refundLine(order)}
                        </div>
                    );
                },
            },
            {
                id: 'payment',
                header: t`Payment`,
                enableHiding: true,
                cell: (info: CellContext<Order, unknown>) => {
                    const order = info.row.original;
                    return (
                        <div className={classes.paymentStatus}>
                            {paymentLabel(order)}
                        </div>
                    );
                },
            },
            {
                id: 'status',
                header: t`Status`,
                enableHiding: true,
                cell: (info: CellContext<Order, unknown>) => {
                    const order = info.row.original;
                    return (
                        <StatusTag tone={orderStatus(order.status).tone}>
                            {orderStatus(order.status).label}
                        </StatusTag>
                    );
                },
            },
            {
                id: 'actions',
                header: () => <VisuallyHidden>{t`Actions`}</VisuallyHidden>,
                enableHiding: false,
                cell: (info: CellContext<Order, unknown>) => {
                    const order = info.row.original;
                    return (
                        <div className={classes.actionsMenu}>
                            {renderActionMenu(order)}
                        </div>
                    );
                },
                meta: {
                    sticky: 'right',
                },
            },
        ],
        [event.id, emailPopoverId, productsById]
    );

    if (orders.length === 0) {
        return (
            <>
                {toolbar && <div className={classes.emptyToolbar}>{toolbar}</div>}
                <NoResultsSplash
                    imageHref={'/blank-slate/orders.svg'}
                    heading={t`No orders to show`}
                    subHeading={(
                        <p>
                            {t`Your orders will appear here once they start rolling in.`}
                        </p>
                    )}
                />
            </>
        );
    }

    return (
        <>
            <TanStackTable
                data={orders}
                columns={columns}
                storageKey="orders-table"
                enableColumnVisibility={true}
                renderColumnVisibilityToggle={(table) => <ColumnVisibilityToggle table={table}/>}
                renderMobileRow={renderMobileRow}
                toolbarStart={toolbar}
            />
            {orderId && (
                <>
                    {isRefundModalOpen && <RefundOrderModal onClose={refundModal.close} orderId={orderId}/>}
                    {isViewModalOpen && <ManageOrderModal onClose={viewModal.close} orderId={orderId}/>}
                    {isCancelModalOpen && <CancelOrderModal onClose={cancelModal.close} orderId={orderId}/>}
                    {isMessageModalOpen && <SendMessageModal
                        onClose={messageModal.close}
                        orderId={orderId}
                        messageType={MessageType.OrderOwner}
                    />}
                </>
            )}
        </>
    )
};
