import {useState} from "react";
import {Button, Menu} from "@mantine/core";
import {useClipboard} from "@mantine/hooks";
import {
    IconChevronDown,
    IconCopy,
    IconReceipt2,
    IconReceiptDollar,
    IconReceiptRefund,
    IconRepeat,
    IconSend,
    IconTrash,
} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {DonationReceipt, Event, Invoice, MessageType, Order} from "../../../types.ts";
import {useResendOrderConfirmation} from "../../../mutations/useResendOrderConfirmation.ts";
import {useMarkOrderAsPaid} from "../../../mutations/useMarkOrderAsPaid.ts";
import {orderClient} from "../../../api/order.client.ts";
import {downloadBinary} from "../../../utilites/download.ts";
import {withLoadingNotification} from "../../../utilites/withLoadingNotification.tsx";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {eventCheckoutUrl} from "../../../utilites/urlHelper.ts";
import {RefundOrderModal} from "../../modals/RefundOrderModal";
import {CancelOrderModal} from "../../modals/CancelOrderModal";
import {SendMessageModal} from "../../modals/SendMessageModal";
import classes from "./OrderActionsMenu.module.scss";

type OpenModal = 'refund' | 'cancel' | 'message' | null;

/**
 * What can be done to an order: message, link, invoice, mark as paid, refund, resend, cancel. In the
 * order panel since the Commandes table of the event (Figma « Commandes et participants ») has only a
 * chevron per row; the same choices as the « ⋮ » menu of OrdersTable (admin orders page).
 */
export const OrderActionsMenu = ({order, event}: { order: Order, event: Event }) => {
    const [modal, setModal] = useState<OpenModal>(null);
    const resendMutation = useResendOrderConfirmation();
    const markAsPaidMutation = useMarkOrderAsPaid();
    const clipboard = useClipboard({timeout: 2000});

    const isRefundable = !order.is_free_order
        && order.status !== 'AWAITING_OFFLINE_PAYMENT'
        && order.payment_provider === 'STRIPE'
        && order.refund_status !== 'REFUNDED';

    const markAsPaid = () => markAsPaidMutation.mutate({eventId: event.id, orderId: order.id}, {
        onSuccess: () => showSuccess(t`Order marked as paid`),
        onError: () => showError(t`There was an error marking the order as paid`),
    });

    const resend = () => resendMutation.mutate({eventId: event.id, orderId: order.id}, {
        onSuccess: () => showSuccess(t`Your message has been sent`),
        onError: () => showError(t`There was an error sending your message`),
    });

    const copyLink = () => {
        clipboard.copy(eventCheckoutUrl(order.event_id, order.short_id, 'summary'));
        showSuccess(t`Customer link copied to clipboard`);
    };

    const downloadInvoice = (invoice: Invoice) => withLoadingNotification(async () => {
        const blob = await orderClient.downloadInvoice(event.id, invoice.order_id);
        downloadBinary(blob, invoice.invoice_number + '.pdf');
    }, {
        loading: {title: t`Downloading Invoice`, message: t`Please wait while we prepare your invoice...`},
        success: {title: t`Success`, message: t`Invoice downloaded successfully`},
        error: {title: t`Error`, message: t`Failed to download invoice. Please try again.`},
    });

    const downloadReceipt = (receipt: DonationReceipt) => withLoadingNotification(async () => {
        const blob = await orderClient.downloadDonationReceipt(event.id, receipt.order_id);
        downloadBinary(blob, 'recu-' + receipt.receipt_number + '.pdf');
    }, {
        loading: {title: t`Downloading receipt`, message: t`Please wait while we prepare the tax receipt...`},
        success: {title: t`Success`, message: t`Tax receipt downloaded successfully`},
        error: {title: t`Error`, message: t`Failed to download the tax receipt. Please try again.`},
    });

    return (
        <>
            <Menu shadow="md" width={270} position="bottom-end">
                <Menu.Target>
                    <Button variant="transparent" className={classes.trigger}
                            rightSection={<IconChevronDown size={16} stroke={2}/>}>
                        {t`Actions`}
                    </Button>
                </Menu.Target>
                <Menu.Dropdown>
                    <Menu.Item onClick={() => setModal('message')} leftSection={<IconSend size={14}/>}>
                        {t`Message buyer`}
                    </Menu.Item>
                    <Menu.Item onClick={copyLink} leftSection={<IconCopy size={14}/>}>
                        {t`Copy customer link`}
                    </Menu.Item>
                    {order.latest_invoice && (
                        <Menu.Item onClick={() => downloadInvoice(order.latest_invoice as Invoice)}
                                   leftSection={<IconReceipt2 size={14}/>}>{t`Download invoice`}</Menu.Item>
                    )}
                    {order.donation_receipt && (
                        <Menu.Item onClick={() => downloadReceipt(order.donation_receipt as DonationReceipt)}
                                   leftSection={<IconReceipt2 size={14}/>}>{t`Download tax receipt`}</Menu.Item>
                    )}
                    {order.status === 'AWAITING_OFFLINE_PAYMENT' && (
                        <Menu.Item onClick={markAsPaid} leftSection={<IconReceiptDollar size={14}/>}>
                            {t`Mark as paid`}
                        </Menu.Item>
                    )}
                    {isRefundable && (
                        <Menu.Item onClick={() => setModal('refund')} leftSection={<IconReceiptRefund size={14}/>}>
                            {t`Refund order`}
                        </Menu.Item>
                    )}
                    {order.status === 'COMPLETED' && (
                        <Menu.Item onClick={resend} leftSection={<IconRepeat size={14}/>}>
                            {t`Resend order email`}
                        </Menu.Item>
                    )}
                    {order.status !== 'CANCELLED' && (
                        <>
                            <Menu.Divider/>
                            <Menu.Item color="red" onClick={() => setModal('cancel')} leftSection={<IconTrash size={14}/>}>
                                {t`Cancel order`}
                            </Menu.Item>
                        </>
                    )}
                </Menu.Dropdown>
            </Menu>

            {modal === 'refund' && <RefundOrderModal onClose={() => setModal(null)} orderId={order.id}/>}
            {modal === 'cancel' && <CancelOrderModal onClose={() => setModal(null)} orderId={order.id}/>}
            {modal === 'message' && (
                <SendMessageModal onClose={() => setModal(null)} orderId={order.id} messageType={MessageType.OrderOwner}/>
            )}
        </>
    );
};
