import {useState} from "react";
import {plural, t} from "@lingui/macro";
import {Button, Checkbox, Drawer, Modal, Textarea, UnstyledButton} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {IconCloudStorm, IconX} from "@tabler/icons-react";
import {Event, IdParam} from "../../../types.ts";
import {EventChangeStatus} from "../../../api/eventChange.client.ts";
import {useCancelEvent} from "../../../mutations/useCancelEvent.ts";
import {showError, showSuccess} from "../../../utilites/notifications.tsx";
import {ToggleRow} from "../../routes/organizer/Settings/SettingsUi.tsx";
import popup from "../../routes/organizer/Settings/organization/CloseOrganizer.module.scss";
import classes from "./CancelEventModal.module.scss";

// eslint-disable-next-line lingui/no-unlocalized-strings
const PHONE = '(max-width: 767px)';

interface CancelEventModalProps {
    eventId: IdParam;
    event: Event;
    audience?: EventChangeStatus['audience'];
    onClose: () => void;
}

const defaultMessage = (title: string) => [
    t`Because of the weather, we unfortunately have to cancel ${title}. Everyone's safety comes first.`,
    t`Thank you for your understanding. We hope to see you at a future event!`,
].join('\n\n');

/**
 * « Annuler l'événement »: the red popup of « Archiver ou supprimer » (a sheet on phones). The message
 * to the participants, automatic refunds (on by default) and a box to tick: it cannot be undone.
 */
export const CancelEventModal = ({eventId, event, audience, onClose}: CancelEventModalProps) => {
    const isMobile = useMediaQuery(PHONE);
    const cancelMutation = useCancelEvent();
    const title = event.title ?? '';
    const [message, setMessage] = useState(defaultMessage(title));
    const [refundOrders, setRefundOrders] = useState(true);
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recipients = audience?.recipients ?? 0;
    const paidOnline = audience?.paid_online_orders ?? 0;
    const paidOffline = audience?.paid_offline_orders ?? 0;

    const submit = () => {
        if (message.trim() === '') {
            setError(t`Write a message to the participants.`);
            return;
        }

        cancelMutation.mutate({
            eventId,
            request: {message: message.trim(), refund_orders: refundOrders, confirmed},
        }, {
            onSuccess: () => {
                showSuccess(t`The event is cancelled. The participants are being told, and the orders cancelled one by one.`);
                onClose();
            },
            onError: (error: any) => {
                const errors = error?.response?.data?.errors;
                setError(errors?.message?.[0] ?? null);
                showError(errors?.confirmed?.[0] ?? error?.response?.data?.message ?? t`The event could not be cancelled. Please try again.`);
            },
        });
    };

    const heading = (
        <div className={popup.heading}>
            <span className={popup.alert}><IconCloudStorm size={26} stroke={1.75}/></span>
            <h2 className={popup.title}>{t`Cancel the event`}</h2>
            <p className={popup.subtitle}>{t`${title} will not take place.`}</p>
        </div>
    );

    const body = (
        <div className={popup.popupBody}>
            <Textarea
                className={classes.message}
                label={t`Message to the participants`}
                description={t`Sent by email to every buyer and participant.`}
                autosize
                minRows={5}
                maxLength={5000}
                value={message}
                error={error}
                onChange={(changeEvent) => {
                    setError(null);
                    setMessage(changeEvent.currentTarget.value);
                }}
            />

            <div className={classes.refundBox}>
                <ToggleRow
                    label={t`Refund every paid order automatically`}
                    hint={paidOffline > 0
                        ? t`Orders paid online go back on the card that paid. Orders paid another way are listed for you to refund.`
                        : t`Orders paid online go back on the card that paid, in full.`}
                    checked={refundOrders}
                    onChange={setRefundOrders}
                />
            </div>

            <ul className={classes.consequences}>
                <li>{t`Ticket sales stop right away and the event page shows « Event cancelled ».`}</li>
                <li>{t`Every order is cancelled: tickets are no longer valid.`}</li>
                <li>
                    {recipients === 0
                        ? t`Nobody has a ticket yet: no email will be sent.`
                        : plural(recipients, {
                            one: '# person gets your message by email.',
                            other: '# people get your message by email.',
                        })}
                </li>
                {refundOrders && paidOnline > 0 && (
                    <li>
                        {plural(paidOnline, {
                            one: '# order paid online is refunded in full.',
                            other: '# orders paid online are refunded in full.',
                        })}
                    </li>
                )}
            </ul>

            <Checkbox
                className={classes.confirm}
                checked={confirmed}
                onChange={(changeEvent) => setConfirmed(changeEvent.currentTarget.checked)}
                label={t`I understand that cancelling cannot be undone.`}
            />

            <div className={popup.actions}>
                <Button variant="transparent" className={popup.solid} leftSection={<IconCloudStorm size={18} stroke={2}/>}
                        onClick={submit} loading={cancelMutation.isPending} disabled={!confirmed}>
                    {t`Cancel the event`}
                </Button>
            </div>
        </div>
    );

    if (isMobile) {
        return (
            <Drawer opened onClose={onClose} position="bottom" size="auto" withCloseButton={false}
                    classNames={{content: popup.sheet, body: popup.sheetBody}}>
                {heading}
                {body}
            </Drawer>
        );
    }

    return (
        <Modal opened onClose={onClose} centered size={640} radius={32} withCloseButton={false}
               classNames={{content: popup.popup, body: popup.popupInner}}>
            <div className={popup.popupHead}>
                {heading}
                <UnstyledButton className={popup.close} onClick={onClose} aria-label={t`Close`}>
                    <IconX size={20} stroke={2}/>
                </UnstyledButton>
            </div>
            {body}
        </Modal>
    );
};
