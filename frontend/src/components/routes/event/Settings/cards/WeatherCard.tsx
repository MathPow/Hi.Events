import {useState} from "react";
import {Link} from "react-router";
import {plural, t} from "@lingui/macro";
import {Button, Skeleton} from "@mantine/core";
import {IconCalendarEvent, IconCloudStorm} from "@tabler/icons-react";
import {Event, IdParam} from "../../../../../types.ts";
import {EventChangeRefundStatus, EventChangeRefundToCheck} from "../../../../../api/eventChange.client.ts";
import {useGetEventChangeStatus} from "../../../../../queries/useGetEventChangeStatus.ts";
import {formatDateWithLocale} from "../../../../../utilites/dates.ts";
import {formatCurrency} from "../../../../../utilites/currency.ts";
import {PostponeEventModal} from "../../../../modals/PostponeEventModal";
import {CancelEventModal} from "../../../../modals/CancelEventModal";
import {SettingsCard, Tag, TagTone} from "../../../organizer/Settings/SettingsUi.tsx";
import settings from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";
import classes from "./WeatherCard.module.scss";

const statusLabel = (status: EventChangeRefundStatus) => ({
    PENDING: t`In progress`,
    REFUNDED: t({message: 'Refunded', context: 'order'}),
    CANCELLED_NO_PAYMENT: t`Nothing to refund`,
    MANUAL_REFUND_REQUIRED: t`To refund yourself`,
    NOT_REFUNDED: t`Not refunded`,
    SKIPPED: t`Already cancelled`,
    FAILED: t`Refund failed`,
})[status];

const statusTone = (status: EventChangeRefundStatus): TagTone => ({
    PENDING: 'neutral',
    REFUNDED: 'green',
    CANCELLED_NO_PAYMENT: 'neutral',
    MANUAL_REFUND_REQUIRED: 'yellow',
    NOT_REFUNDED: 'neutral',
    SKIPPED: 'neutral',
    FAILED: 'yellow',
} as Record<EventChangeRefundStatus, TagTone>)[status];

interface WeatherCardProps {
    eventId: IdParam;
    event: Event;
    // The dates of « Infos de base » changed under it.
    onPostponed: () => void;
}

/**
 * « Mauvaise météo ? »: postpone or cancel the event in one go. Participants get the organizer's
 * message by email, and orders are refunded (on request after a postponement, all at once after a
 * cancellation). Then the card tells what happened, and lists the orders to look at.
 */
export const WeatherCard = ({eventId, event, onPostponed}: WeatherCardProps) => {
    const {data: status, isLoading} = useGetEventChangeStatus(eventId);
    const [modal, setModal] = useState<'postpone' | 'cancel' | null>(null);
    const timezone = event.timezone;
    const cancelledAt = status?.cancelled_at ?? event.cancelled_at ?? null;
    const date = (value: string | null) => value ? formatDateWithLocale(value, 'shortDateTime', timezone) : '';
    const ordersPath = `/manage/event/${eventId}/orders`;

    const cancellationSummary = () => {
        const counts = status?.cancellation?.counts;
        if (!counts) {
            return null;
        }

        return [
            counts.REFUNDED > 0 && plural(counts.REFUNDED, {one: '# refunded', other: '# refunded'}),
            counts.CANCELLED_NO_PAYMENT > 0 && plural(counts.CANCELLED_NO_PAYMENT, {one: '# with nothing to refund', other: '# with nothing to refund'}),
            counts.NOT_REFUNDED > 0 && plural(counts.NOT_REFUNDED, {one: '# not refunded', other: '# not refunded'}),
            counts.MANUAL_REFUND_REQUIRED > 0 && plural(counts.MANUAL_REFUND_REQUIRED, {one: '# to refund yourself', other: '# to refund yourself'}),
            counts.FAILED > 0 && plural(counts.FAILED, {one: '# failed', other: '# failed'}),
            counts.PENDING > 0 && plural(counts.PENDING, {one: '# in progress', other: '# in progress'}),
        ].filter(Boolean).join(' · ');
    };

    const refundRow = (refund: EventChangeRefundToCheck) => (
        <li key={refund.order_id} className={classes.row}>
            <span className={classes.rowText}>
                <span>
                    <strong>{refund.order_public_id ?? `#${refund.order_id}`}</strong>
                    {refund.buyer_name ? ` · ${refund.buyer_name}` : ''}
                    {refund.amount > 0 && refund.currency ? ` · ${formatCurrency(refund.amount, refund.currency)}` : ''}
                </span>
                <span className={classes.rowMeta}>
                    {refund.source === 'POSTPONEMENT' ? t`Asked after the postponement` : t`Event cancelled`}
                    {refund.buyer_email ? ` · ${refund.buyer_email}` : ''}
                    {refund.error ? ` · ${refund.error}` : ''}
                </span>
            </span>
            <Tag tone={statusTone(refund.status)}>{statusLabel(refund.status)}</Tag>
            <Link to={`${ordersPath}#order-${refund.order_id}`} className={extra.inlineLink}>{t`View order`}</Link>
        </li>
    );

    const toCheck = status?.refunds_to_check ?? [];
    const summary = cancellationSummary();
    const cancelledOn = date(cancelledAt);

    return (
        <SettingsCard
            id="weather"
            full
            className={extra.anchored}
            title={t`Bad weather?`}
            subtitle={cancelledAt
                ? t`The event is cancelled. Here is what happened to each order.`
                : t`Postpone or cancel the event in one go: participants get your message by email, and refunds are handled for you.`}
        >
            {isLoading ? (
                <Skeleton height={48} radius="md"/>
            ) : cancelledAt ? (
                <div className={classes.cancelled}>
                    <span className={classes.cancelledIcon}><IconCloudStorm size={22} stroke={1.75}/></span>
                    <span className={classes.stateText}>
                        <span className={`${classes.stateTitle} ${classes.cancelledTitle}`}>
                            {t`Event cancelled on ${cancelledOn}`}
                        </span>
                        <span className={classes.stateHint}>
                            {status?.cancellation && plural(status.cancellation.recipients_count, {
                                one: '# person told by email.',
                                other: '# people told by email.',
                            })}
                            {summary ? ` ${summary}.` : ''}
                            {status?.cancellation && !status.cancellation.refund_orders
                                ? ` ${t`Automatic refunds were turned off: refund orders from Orders if you need to.`}`
                                : ''}
                        </span>
                    </span>
                </div>
            ) : (
                <div className={classes.actions}>
                    <Button variant="transparent" className={settings.outlineButton}
                            leftSection={<IconCalendarEvent size={18} stroke={2}/>}
                            onClick={() => setModal('postpone')}>
                        {t`Postpone the event`}
                    </Button>
                    <Button variant="transparent" className={settings.dangerOutline}
                            leftSection={<IconCloudStorm size={18} stroke={2}/>}
                            onClick={() => setModal('cancel')}>
                        {t`Cancel the event`}
                    </Button>
                </div>
            )}

            {!!status?.date_changes.length && (
                <>
                    <h3 className={classes.sectionTitle}>{t`Postponements`}</h3>
                    <ul className={classes.list}>
                        {status.date_changes.map((change) => {
                            const oldStart = date(change.old_start_date);
                            const newStart = date(change.new_start_date);
                            const postponedOn = date(change.created_at);
                            const deadline = date(change.refund_deadline);

                            return (
                                <li key={change.id} className={classes.row}>
                                    <span className={classes.rowText}>
                                        <span>{t`From ${oldStart} to ${newStart}`}</span>
                                        <span className={classes.rowMeta}>
                                            {t`Postponed on ${postponedOn}`}
                                            {' · '}
                                            {plural(change.recipients_count, {one: '# person told', other: '# people told'})}
                                            {change.refunds_allowed && change.refund_deadline && (
                                                <>
                                                    {' · '}
                                                    {t`Refunds until ${deadline}`}
                                                    {' · '}
                                                    {plural(change.refunds_count, {one: '# refund asked', other: '# refunds asked'})}
                                                </>
                                            )}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            {toCheck.length > 0 && (
                <>
                    <h3 className={classes.sectionTitle}>{t`Orders to look at`}</h3>
                    <p className={settings.softHint}>
                        {t`Refund them from Orders, or the way they were paid. Failed refunds can be tried again from the order.`}
                    </p>
                    <ul className={classes.list}>{toCheck.map(refundRow)}</ul>
                </>
            )}

            {modal === 'postpone' && (
                <PostponeEventModal
                    eventId={eventId}
                    event={event}
                    audience={status?.audience}
                    onClose={() => setModal(null)}
                    onPostponed={onPostponed}
                />
            )}
            {modal === 'cancel' && (
                <CancelEventModal
                    eventId={eventId}
                    event={event}
                    audience={status?.audience}
                    onClose={() => setModal(null)}
                />
            )}
        </SettingsCard>
    );
};
