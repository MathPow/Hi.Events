import {useState} from "react";
import {useParams, useSearchParams} from "react-router";
import {t} from "@lingui/macro";
import {Button, Checkbox, Skeleton} from "@mantine/core";
import {RefundRequest as RefundRequestData} from "../../../../api/eventChange.client.ts";
import {useGetRefundRequest} from "../../../../queries/useGetRefundRequest.ts";
import {useSubmitRefundRequest} from "../../../../mutations/useSubmitRefundRequest.ts";
import {formatDateWithLocale} from "../../../../utilites/dates.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {PublicBarLink, PublicPageBar} from "../../../common/PublicPageBar";
import {PublicPageFooter} from "../../../common/PublicPageFooter";
import shell from "../../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import classes from "./RefundRequest.module.scss";

// eslint-disable-next-line lingui/no-unlocalized-strings
const PAGE_BACKGROUND = 'body, .ssr-loader { background-color: var(--dehors-creme) !important; }';

const refusalText = (refusal: string, fallback: string | null) => ({
    DEADLINE_PASSED: t`The deadline to ask for a refund has passed.`,
    REFUNDS_NOT_ALLOWED: t`The organizer does not offer refunds for this change of date.`,
    ALREADY_CANCELLED: t`This order is already cancelled.`,
    ALREADY_REFUNDED: t`This order has already been refunded.`,
    CHECKED_IN: t`A ticket of this order has already been checked in.`,
    EVENT_CANCELLED: t`The event has been cancelled: the organizer will tell you what happens to your order.`,
    LINK_REPLACED: t`The date of the event changed again: use the link in the latest email.`,
} as Record<string, string>)[refusal] ?? fallback ?? t`This order can't be refunded.`;

const Done = ({request}: { request: RefundRequestData }) => {
    const amount = formatCurrency(request.refundable_amount, request.currency);

    return (
        <p className={`${classes.notice} ${classes.success}`} role="status">
            {request.outcome === 'REFUNDED'
                ? t`Your order is cancelled. The refund of ${amount} is on its way to the card you paid with: it usually shows up within 5 to 10 business days.`
                : request.outcome === 'MANUAL_REFUND_REQUIRED'
                    ? t`Your order is cancelled. The organizer has been told and will refund your ${amount} themselves.`
                    : t`Your order is cancelled and your spot is freed. Thank you for letting us know!`}
        </p>
    );
};

/**
 * « Je ne peux plus venir : me faire rembourser », from the email sent when an event is postponed:
 * the order and the amount, an explicit confirmation, then the order is cancelled and refunded.
 */
const RefundRequest = () => {
    const {eventId, orderShortId} = useParams();
    const [searchParams] = useSearchParams();
    const change = searchParams.get('change');
    const token = searchParams.get('token');
    const {data: request, isLoading, isError, refetch} = useGetRefundRequest(eventId, orderShortId ?? '', change, token);
    const submitMutation = useSubmitRefundRequest();
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const date = (value: string | null) => value && request
        ? formatDateWithLocale(value, 'fullDateTime', request.event_timezone)
        : '';

    const submit = () => {
        setError(null);
        submitMutation.mutate({eventId: eventId!, orderShortId: orderShortId!, change: change!, token: token!}, {
            onError: (submitError: any) => {
                if (submitError?.response?.status === 409) {
                    refetch();
                    return;
                }
                setError(submitError?.response?.data?.message ?? t`Something went wrong. Please try again.`);
            },
        });
    };

    const content = () => {
        if (isLoading) {
            return <Skeleton height={320} radius={24}/>;
        }

        if (isError || !request || !change || !token) {
            return (
                <>
                    <h1 className={classes.title}>{t`This link is not valid`}</h1>
                    <p className={classes.text}>
                        {t`Use the button in the email you received, or find your tickets in My tickets.`}
                    </p>
                    <PublicBarLink to={'/my-tickets'}>{t`My tickets`}</PublicBarLink>
                </>
            );
        }

        const amount = formatCurrency(request.refundable_amount, request.currency);
        const buyer = [request.buyer_first_name, request.buyer_last_name].filter(Boolean).join(' ');
        const deadline = date(request.refund_deadline);
        const contact = request.organizer_name ?? request.support_email;

        return (
            <>
                <p className={classes.overline}>{request.event_title}</p>
                <h1 className={classes.title}>{t`I can no longer come`}</h1>

                <dl className={classes.facts}>
                    <div className={classes.fact}>
                        <dt>{t`New date`}</dt>
                        <dd>{date(request.event_start_date)}</dd>
                    </div>
                    <div className={classes.fact}>
                        <dt>{t`Order`}</dt>
                        <dd>{request.order_public_id}{buyer ? ` · ${buyer}` : ''}</dd>
                    </div>
                    {request.refund_method !== 'NONE' && (
                        <div className={`${classes.fact} ${classes.amount}`}>
                            <dt>{t`Refund`}</dt>
                            <dd>{amount}</dd>
                        </div>
                    )}
                </dl>

                {request.outcome ? (
                    <Done request={request}/>
                ) : request.refusal ? (
                    <p className={classes.notice} role="alert">{refusalText(request.refusal, request.refusal_message)}</p>
                ) : (
                    <>
                        <p className={classes.text}>
                            {request.refund_method === 'ONLINE'
                                ? t`Your order will be cancelled and ${amount} refunded in full to the card you paid with.`
                                : request.refund_method === 'OFFLINE'
                                    ? t`Your order will be cancelled. You did not pay online: the organizer will refund your ${amount} themselves.`
                                    : t`Your order will be cancelled and your spot freed for someone else.`}
                            {deadline ? ` ${t`You can ask until ${deadline}.`}` : ''}
                        </p>

                        <Checkbox
                            className={classes.confirm}
                            checked={confirmed}
                            onChange={(changeEvent) => setConfirmed(changeEvent.currentTarget.checked)}
                            label={t`I understand that my tickets will no longer be valid.`}
                        />

                        {error && <p className={classes.notice} role="alert">{error}</p>}

                        <Button className={classes.button} fullWidth disabled={!confirmed}
                                loading={submitMutation.isPending} onClick={submit}>
                            {request.refund_method === 'NONE' ? t`Cancel my order` : t`Cancel my order and get refunded`}
                        </Button>
                    </>
                )}

                {request.support_email && (
                    <p className={classes.text}>
                        {t`A question?`}{' '}
                        <a className={classes.link} href={`mailto:${request.support_email}`}>
                            {t`Write to ${contact}`}
                        </a>
                    </p>
                )}
            </>
        );
    };

    return (
        <main className={shell.page}>
            <style>{PAGE_BACKGROUND}</style>
            <div className={shell.content}>
                <div className={shell.bar}>
                    {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                    <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}/>
                </div>
                <div className={classes.main}>
                    <section className={classes.card}>{content()}</section>
                </div>
                <PublicPageFooter/>
            </div>
        </main>
    );
};

export default RefundRequest;
