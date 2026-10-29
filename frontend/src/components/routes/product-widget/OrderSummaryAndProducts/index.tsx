import {t, Trans} from "@lingui/macro";
import {useLocation, useNavigate, useParams} from "react-router";
import {Menu, UnstyledButton} from "@mantine/core";
import {IconCheck} from "@tabler/icons-react";
import {CSSProperties, ReactNode, useEffect, useState} from "react";
import {useQueryClient} from "@tanstack/react-query";

import {GET_ORDER_PUBLIC_QUERY_KEY, useGetOrderPublic} from "../../../../queries/useGetOrderPublic.ts";
import {eventCheckoutPath, eventHomepageUrl} from "../../../../utilites/urlHelper.ts";
import {eventLocation, formatAddress, isAddressSet} from "../../../../utilites/addressUtilities.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {computeThemeVariables, validateThemeSettings} from "../../../../utilites/themeUtils.ts";
import {showError, showSuccess} from "../../../../utilites/notifications.tsx";
import {orderClientPublic} from "../../../../api/order.client.ts";
import {downloadBinary} from "../../../../utilites/download.ts";
import {withLoadingNotification} from "../../../../utilites/withLoadingNotification.tsx";

import {LoadingMask} from "../../../common/LoadingMask";
import {HomepageInfoMessage} from "../../../common/HomepageInfoMessage";
import {CalendarOptionsPopover} from "../../../common/CalendarOptionsPopover";
import {ShareComponent} from "../../../common/ShareIcon";
import {PublicBarLink, PublicPageBar} from "../../../common/PublicPageBar";
import {PublicPageFooter} from "../../../common/PublicPageFooter";
import {PublicIcon, PublicIconName} from "../../../common/PublicIcon";
import {EditAttendeeModal} from "./EditAttendeeModal";
import {EditOrderModal} from "./EditOrderModal";
import {ConfirmationTicket} from "./ConfirmationTicket";
import {OtherEvents} from "./OtherEvents";
import {eventRangeLabel, timezoneLabel} from "./confirmationDates.ts";

import {useEditAttendeePublic} from "../../../../mutations/useEditAttendeePublic";
import {useEditOrderPublic} from "../../../../mutations/useEditOrderPublic";
import {useResendAttendeeTicketPublic} from "../../../../mutations/useResendAttendeeTicketPublic";
import {useResendOrderConfirmationPublic} from "../../../../mutations/useResendOrderConfirmationPublic";

import {Attendee, Event, Invoice, Order} from "../../../../types.ts";
import classes from './OrderSummaryAndProducts.module.scss';
import {clearWaitlistJoinedForEvent} from "../../../../hooks/useWaitlistJoined.ts";
import {useRoughEdges} from "../../../../hooks/useRoughEdges.ts";
// Purchase tracking is handled by the parent Checkout layout

const paymentStatusLabel = (order: Order): string | null => {
    const paymentStatuses: Record<string, string> = {
        'NO_PAYMENT_REQUIRED': t`No Payment Required`,
        'AWAITING_PAYMENT': t`Awaiting Payment`,
        'PAYMENT_FAILED': t`Payment Failed`,
        'PAYMENT_RECEIVED': t`Payment Received`,
        'AWAITING_OFFLINE_PAYMENT': t`Awaiting Offline Payment`,
    };

    return order.payment_status ? paymentStatuses[order.payment_status] || null : null;
};

const refundStatusLabel = (order: Order): string | null => {
    const refundStatuses: Record<string, string> = {
        'REFUND_PENDING': t`Refund Pending`,
        'REFUND_FAILED': t`Refund Failed`,
        'REFUNDED': t`Refunded`,
        'PARTIALLY_REFUNDED': t`Partially Refunded`,
    };

    return order.refund_status ? refundStatuses[order.refund_status] || null : null;
};

// La pastille du recapitulatif (« Paye » dans la maquette), selon l'etat de la commande.
const orderStatusPill = (order: Order): string | null => {
    if (order.status === 'CANCELLED') return t`Cancelled`;
    if (order.refund_status === 'REFUNDED') return t`Refunded`;
    if (order.refund_status === 'PARTIALLY_REFUNDED') return t`Partially Refunded`;
    if (order.status === 'AWAITING_OFFLINE_PAYMENT' || order.payment_status === 'AWAITING_OFFLINE_PAYMENT') return t`Awaiting payment`;
    if (order.payment_status === 'NO_PAYMENT_REQUIRED') return t`Free`;
    if (order.payment_status === 'PAYMENT_RECEIVED') return t`Paid`;
    return null;
};

const Card = ({title, aside, className, children}: {
    title?: ReactNode,
    aside?: ReactNode,
    className?: string,
    children: ReactNode
}) => (
    <section className={className ? `${classes.card} ${className}` : classes.card} data-rough>
        {(title || aside) && (
            <div className={classes.cardHeader}>
                {title && <h2 className={classes.cardTitle}>{title}</h2>}
                {aside}
            </div>
        )}
        {children}
    </section>
);

const HtmlCard = ({title, html}: { title: string, html: string }) => (
    <Card title={title}>
        <div className={classes.richText} dangerouslySetInnerHTML={{__html: html}}/>
    </Card>
);

// Les trois boutons de la maquette: dans l'en-tete sur ordinateur, sous le billet sur mobile.
const ConfirmationActions = ({event, order, ticketsUrl, mapsUrl, className}: {
    event: Event,
    order: Order,
    ticketsUrl: string | null,
    mapsUrl: string | null,
    className: string,
}) => {
    if (order.status === 'CANCELLED') {
        return null;
    }

    return (
        <div className={`${classes.actions} ${className}`}>
            <CalendarOptionsPopover event={event}>
                <UnstyledButton className={`${classes.button} ${classes.buttonPrimary}`} data-rough="button">
                    <PublicIcon name={'calendrier'} size={20}/>
                    {t`Add to Calendar`}
                </UnstyledButton>
            </CalendarOptionsPopover>
            {(ticketsUrl || mapsUrl) && (
                <div className={classes.secondaryActions}>
                    {ticketsUrl && (
                        <a className={`${classes.button} ${classes.buttonOutline}`} href={ticketsUrl} target="_blank" rel="noreferrer">
                            <PublicIcon name={'telecharger'} size={20}/>
                            <span className={classes.desktopOnly}>{t`Download tickets`}</span>
                            <span className={classes.mobileOnly}>{t`PDF tickets`}</span>
                        </a>
                    )}
                    {mapsUrl && (
                        <a className={`${classes.button} ${classes.buttonOutline}`} href={mapsUrl} target="_blank" rel="noreferrer">
                            <PublicIcon name={'itineraire'} size={20}/>
                            {t`Directions`}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};

const ActionRow = ({icon, label}: { icon: PublicIconName, label: string }) => (
    <>
        <span className={classes.actionIcon} data-rough><PublicIcon name={icon} size={20}/></span>
        <span className={classes.actionLabel}>{label}</span>
        <PublicIcon name={'chevron-droite'} size={18} className={classes.actionChevron}/>
    </>
);

const ManageAction = ({icon, label, onClick, href}: {
    icon: PublicIconName,
    label: string,
    onClick?: () => void,
    href?: string,
}) => href ? (
    <a className={classes.action} data-rough="button" href={href} target="_blank" rel="noreferrer">
        <ActionRow icon={icon} label={label}/>
    </a>
) : (
    <UnstyledButton className={classes.action} data-rough="button" onClick={onClick}>
        <ActionRow icon={icon} label={label}/>
    </UnstyledButton>
);

// Une action propre a un participant: directe s'il n'y en a qu'un, sinon on choisit lequel.
const AttendeeAction = ({icon, label, attendees, onPick}: {
    icon: PublicIconName,
    label: string,
    attendees: Attendee[],
    onPick: (attendee: Attendee) => void,
}) => {
    if (attendees.length === 1) {
        return <ManageAction icon={icon} label={label} onClick={() => onPick(attendees[0])}/>;
    }

    return (
        <Menu position="bottom-end" shadow="md" withinPortal>
            <Menu.Target>
                <UnstyledButton className={classes.action} data-rough="button">
                    <ActionRow icon={icon} label={label}/>
                </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
                {attendees.map((attendee) => (
                    <Menu.Item key={attendee.id} onClick={() => onPick(attendee)}>
                        {attendee.first_name} {attendee.last_name}
                    </Menu.Item>
                ))}
            </Menu.Dropdown>
        </Menu>
    );
};

const RecapLine = ({label, value, original}: { label: string, value: string, original?: string }) => (
    <div className={classes.recapLine}>
        <span className={classes.recapLabel}>{label}</span>
        <span className={classes.recapValue}>
            {original && <s className={classes.recapOriginal}>{original}</s>}
            {value}
        </span>
    </div>
);

const OrderRecap = ({order}: { order: Order }) => {
    const [expanded, setExpanded] = useState(false);
    const currency = order.currency;
    const pill = orderStatusPill(order);
    const paymentLabel = [paymentStatusLabel(order), refundStatusLabel(order)].filter(Boolean).join(' · ');
    const total = formatCurrency(order.total_gross, currency);
    const discount = order.order_items?.reduce((sum, item) => (
        item.price_before_discount ? sum + (item.price_before_discount - item.price) * item.quantity : sum
    ), 0) || 0;

    return (
        <Card
            title={t`Order recap`}
            aside={(
                <>
                    {pill && <span className={`${classes.pill} ${classes.desktopOnly}`} data-rough>{pill}</span>}
                    <UnstyledButton
                        className={`${classes.recapToggle} ${classes.mobileOnly}`}
                        onClick={() => setExpanded(!expanded)}
                        aria-expanded={expanded}
                    >
                        {total}
                        <PublicIcon name={'chevron'} size={18} className={expanded ? classes.chevronOpen : undefined}/>
                    </UnstyledButton>
                </>
            )}
        >
            <div className={classes.recapBody} data-expanded={expanded || undefined}>
                {order.order_items?.map((item) => (
                    <RecapLine
                        key={item.id}
                        label={`${item.item_name} × ${item.quantity}`}
                        value={formatCurrency((item.price_before_discount || item.price) * item.quantity, currency)}
                    />
                ))}
                {!!order.promo_code && (
                    <RecapLine
                        label={`${t`Promo code`} (${order.promo_code})`}
                        value={discount > 0 ? `-${formatCurrency(discount, currency)}` : ''}
                    />
                )}
                {!!order.platform_contribution && order.platform_contribution > 0 && (
                    <RecapLine label={t`Support the platform`} value={formatCurrency(order.platform_contribution, currency)}/>
                )}
                {order.taxes_and_fees_rollup?.fees?.map((fee, index) => (
                    <RecapLine key={`fee-${index}`} label={fee.name} value={formatCurrency(fee.value, currency)}/>
                ))}
                {order.taxes_and_fees_rollup?.taxes?.map((tax, index) => (
                    <RecapLine key={`tax-${index}`} label={tax.name} value={formatCurrency(tax.value, currency)}/>
                ))}
                <div className={classes.separator}/>
                <div className={classes.recapTotal}>
                    <span>{t`Total`}</span>
                    <span className={classes.recapTotalValue}>{total}</span>
                </div>
                {!!order.deposit_amount && order.deposit_amount > 0 && (
                    <div className={classes.recapLine}>
                        <span className={classes.recapLabel}>
                            {t`Security deposit`}
                            <span className={classes.recapHint}>{t`Sent separately, not included in the total`}</span>
                        </span>
                        <span className={classes.recapValue}>{formatCurrency(order.deposit_amount, currency)}</span>
                    </div>
                )}
            </div>
            <p className={classes.recapMeta}>
                <span className={classes.mobileOnly}>
                    {t`Order`} {order.public_id}{paymentLabel ? ' · ' : ''}
                </span>
                {paymentLabel}
            </p>
            {order.address && isAddressSet(order.address) && (
                <p className={classes.recapMeta}>
                    <span className={classes.recapMetaLabel}>{t`Billing Address`}</span>
                    {formatAddress(order.address)}
                </p>
            )}
        </Card>
    );
};

const EventCard = ({event, order, className}: { event: Event, order: Order, className?: string }) => {
    const location = eventLocation(event);
    const isCancelled = order.status === 'CANCELLED';

    return (
        <Card title={t`The event`} className={className}>
            <div className={classes.detail}>
                <span className={classes.detailIcon} data-rough><PublicIcon name={'calendrier'} size={20}/></span>
                <span className={classes.detailText}>
                    <span className={classes.detailTitle}>
                        {eventRangeLabel(event.start_date, event.end_date, event.timezone)}
                    </span>
                    <span className={classes.detailSubtitle}>{timezoneLabel(event.start_date, event.timezone)}</span>
                </span>
                {!isCancelled && (
                    <CalendarOptionsPopover event={event}>
                        <UnstyledButton className={classes.detailLink}>
                            {t`Calendar`}
                            <PublicIcon name={'fleche'} size={14}/>
                        </UnstyledButton>
                    </CalendarOptionsPopover>
                )}
            </div>
            {location && (
                <div className={classes.detail}>
                    <span className={classes.detailIcon} data-rough><PublicIcon name={'lieu'} size={20}/></span>
                    <span className={classes.detailText}>
                        <span className={classes.detailTitle}>{location.title}</span>
                        {location.subtitle && <span className={classes.detailSubtitle}>{location.subtitle}</span>}
                    </span>
                    <a className={classes.detailLink} href={location.mapsUrl} target="_blank" rel="noreferrer">
                        {t`Directions`}
                        <PublicIcon name={'fleche'} size={14}/>
                    </a>
                </div>
            )}
            {event.settings?.is_online_event && (
                <div className={classes.detail}>
                    <span className={classes.detailIcon} data-rough><PublicIcon name={'globe'} size={20}/></span>
                    <span className={classes.detailText}>
                        <span className={classes.detailTitle}>{t`Online Event`}</span>
                    </span>
                </div>
            )}
        </Card>
    );
};

export const OrderSummaryAndProducts = () => {
    const {eventId, orderShortId} = useParams();
    const location = useLocation();
    const {data: order, isFetched: orderIsFetched, isError} = useGetOrderPublic(eventId, orderShortId, ['event']);
    const event = order?.event;
    const navigate = useNavigate();
    const roughEdges = useRoughEdges<HTMLDivElement>();
    const queryClient = useQueryClient();
    const emailUpdated = location.state?.emailUpdated === true;

    const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
    const [editOrderModalOpened, setEditOrderModalOpened] = useState(false);

    useEffect(() => {
        if (eventId && order && (order.status === 'COMPLETED' || order.status === 'AWAITING_OFFLINE_PAYMENT')) {
            clearWaitlistJoinedForEvent(eventId);
        }
    }, [eventId, order?.status]);

    const editAttendeeMutation = useEditAttendeePublic();
    const editOrderMutation = useEditOrderPublic();
    const resendAttendeeTicketMutation = useResendAttendeeTicketPublic();
    const resendOrderConfirmationMutation = useResendOrderConfirmationPublic();

    const allowSelfEdit = event?.settings?.allow_attendee_self_edit ?? false;

    const handleEditAttendee = (attendee: Attendee, data: any) => {
        editAttendeeMutation.mutate(
            {
                eventId: eventId!,
                orderShortId: orderShortId!,
                attendeeShortId: attendee.short_id,
                data,
            },
            {
                onSuccess: (result) => {
                    queryClient.invalidateQueries({queryKey: [GET_ORDER_PUBLIC_QUERY_KEY]});
                    setEditingAttendee(null);
                    showSuccess(result.message || t`Attendee updated successfully`);
                    if (result.warning) {
                        showError(result.warning);
                    }
                },
                onError: (error: any) => {
                    if (error?.response?.status === 429) {
                        showError(t`Rate limit exceeded. Please try again later.`);
                    } else {
                        showError(error?.response?.data?.message || t`Failed to update attendee`);
                    }
                },
            }
        );
    };

    const handleEditOrder = (data: any) => {
        editOrderMutation.mutate(
            {
                eventId: eventId!,
                orderShortId: orderShortId!,
                data,
            },
            {
                onSuccess: (result) => {
                    setEditOrderModalOpened(false);
                    showSuccess(result.message || t`Order updated successfully`);

                    if (result.new_short_id) {
                        navigate(`/checkout/${eventId}/${result.new_short_id}/summary`, {
                            state: { emailUpdated: true }
                        });
                    } else {
                        queryClient.invalidateQueries({queryKey: [GET_ORDER_PUBLIC_QUERY_KEY]});
                    }

                    if (result.warning) {
                        showError(result.warning);
                    }
                },
                onError: (error: any) => {
                    if (error?.response?.status === 429) {
                        showError(t`Rate limit exceeded. Please try again later.`);
                    } else {
                        showError(error?.response?.data?.message || t`Failed to update order`);
                    }
                },
            }
        );
    };

    const handleResendAttendeeTicket = (attendee: Attendee) => {
        if (!window.confirm(t`Are you sure you want to resend the ticket to ${attendee.email}?`)) {
            return;
        }
        resendAttendeeTicketMutation.mutate(
            {
                eventId: eventId!,
                orderShortId: orderShortId!,
                attendeeShortId: attendee.short_id,
            },
            {
                onSuccess: (result) => {
                    showSuccess(result.message || t`Ticket resent successfully`);
                },
                onError: (error: any) => {
                    if (error?.response?.status === 429) {
                        showError(t`Rate limit exceeded. Please try again later.`);
                    } else {
                        showError(error?.response?.data?.message || t`Failed to resend ticket`);
                    }
                },
            }
        );
    };

    const handleResendOrderConfirmation = () => {
        if (!window.confirm(t`Are you sure you want to resend the order confirmation to ${order?.email}?`)) {
            return;
        }
        resendOrderConfirmationMutation.mutate(
            {
                eventId: eventId!,
                orderShortId: orderShortId!,
            },
            {
                onSuccess: (result) => {
                    showSuccess(result.message || t`Order confirmation resent successfully`);
                },
                onError: (error: any) => {
                    if (error?.response?.status === 429) {
                        showError(t`Rate limit exceeded. Please try again later.`);
                    } else {
                        showError(error?.response?.data?.message || t`Failed to resend order confirmation`);
                    }
                },
            }
        );
    };

    const handleInvoiceDownload = async (invoice: Invoice) => {
        await withLoadingNotification(
            async () => {
                const blob = await orderClientPublic.downloadInvoice(eventId, orderShortId);
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

    if (isError) {
        return (
            <HomepageInfoMessage
                status="not_found"
                message={t`Order Not Found`}
                subtitle={t`We couldn't find the order you're looking for. The link may have expired or the order details may have changed.`}
            />
        );
    }

    if (!orderIsFetched || !order || !event) {
        return <LoadingMask/>;
    }

    if (window?.location.search.includes('failed') || order?.payment_status === 'PAYMENT_FAILED') {
        navigate(eventCheckoutPath(eventId, orderShortId, 'payment') + '?payment_failed=true');
        return;
    }

    if (order?.status !== 'COMPLETED' && order?.status !== 'CANCELLED' && order?.status !== 'AWAITING_OFFLINE_PAYMENT') {
        return (
            <HomepageInfoMessage
                status="processing"
                message={t`Processing order`}
                subtitle={t`This order is being processed.`}
            />
        );
    }

    const isCompleted = order.status === 'COMPLETED';
    const isCancelled = order.status === 'CANCELLED';
    const isAwaitingPayment = order.status === 'AWAITING_OFFLINE_PAYMENT';
    const attendees = order.attendees || [];
    const hasTickets = attendees.length > 0;
    const activeAttendees = attendees.filter((attendee) => attendee.status !== 'CANCELLED');
    const venue = eventLocation(event);
    const ticketsUrl = hasTickets ? `/order/${eventId}/${orderShortId}/print` : null;
    const canSelfEdit = allowSelfEdit && !isCancelled;
    // Avec un seul billet envoye a l'acheteur, renvoyer la confirmation suffit.
    const showResendTicket = canSelfEdit && activeAttendees.length > 0
        && (activeAttendees.length > 1 || activeAttendees[0].email !== order.email);

    // Seule la couleur principale suit le theme de l'evenement (toujours calculee en mode clair):
    // le creme, le texte fonce et la police restent ceux de Dehors.
    const rawThemeSettings = event.settings?.homepage_theme_settings;
    const themeStyles = (rawThemeSettings?.accent
        ? Object.fromEntries(Object.entries(computeThemeVariables({...validateThemeSettings(rawThemeSettings), mode: 'light'}))
            .filter(([name]) => name.startsWith('--theme-accent')))
        : {}) as CSSProperties;

    const title = isCompleted
        ? t`It's confirmed!`
        : isCancelled ? t`Your order has been cancelled` : t`Your order is awaiting payment`;

    const manageActions = [
        canSelfEdit && activeAttendees.length > 0 && (
            <AttendeeAction
                key="edit-attendee"
                icon={'modifier'}
                label={t`Edit an attendee`}
                attendees={activeAttendees}
                onPick={setEditingAttendee}
            />
        ),
        canSelfEdit && (
            <ManageAction
                key="edit-order"
                icon={'modifier'}
                label={t`Edit Order Details`}
                onClick={() => setEditOrderModalOpened(true)}
            />
        ),
        canSelfEdit && (
            <ManageAction
                key="resend-confirmation"
                icon={'courriel'}
                label={t`Resend Confirmation`}
                onClick={handleResendOrderConfirmation}
            />
        ),
        showResendTicket && (
            <AttendeeAction
                key="resend-ticket"
                icon={'billet'}
                label={t`Resend Ticket`}
                attendees={activeAttendees}
                onPick={handleResendAttendeeTicket}
            />
        ),
        ticketsUrl && (
            <ManageAction key="print" icon={'imprimer'} label={t`Print Tickets`} href={ticketsUrl}/>
        ),
        !!order.latest_invoice && (
            <ManageAction
                key="invoice"
                icon={'telecharger'}
                label={t`Download Invoice`}
                onClick={() => handleInvoiceDownload(order.latest_invoice as Invoice)}
            />
        ),
        !isCancelled && (
            <div key="share" className={classes.shareAction}>
                <ShareComponent title={event.title} text={t`Check out this event!`} url={eventHomepageUrl(event)}>
                    <UnstyledButton className={classes.action} data-rough="button">
                        <ActionRow icon={'partager'} label={t`Share Event`}/>
                    </UnstyledButton>
                </ShareComponent>
            </div>
        ),
    ].filter(Boolean);

    return (
        <>
            <div ref={roughEdges} className={classes.page} style={themeStyles}>
                <style>
                    {`
                        body, .ssr-loader {
                            background-color: var(--dehors-creme) !important;
                        }
                    `}
                </style>

                <div className={classes.content}>
                    {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                    <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}/>

                    <header className={classes.hero} data-rough>
                        {isCompleted && <p className={classes.kicker}>{t`See you outside!`}</p>}
                        <h1 className={classes.heroTitle}>{title}</h1>
                        <p className={classes.heroLine}>
                            {isCompleted && <span>{t`Confirmation sent to`} {order.email}</span>}
                            {isCancelled && <span>{t`A cancellation notice has been sent to`} {order.email}</span>}
                            <span className={(isCompleted || isCancelled) ? classes.desktopOnly : undefined}>
                                {(isCompleted || isCancelled) && <span aria-hidden className={classes.dot}>·</span>}
                                {t`Order`} {order.public_id}
                            </span>
                        </p>
                        <ConfirmationActions
                            event={event}
                            order={order}
                            ticketsUrl={ticketsUrl}
                            mapsUrl={venue?.mapsUrl || null}
                            className={classes.desktopOnly}
                        />
                    </header>

                    {emailUpdated && (
                        <div className={classes.notice} data-rough role="status">
                            <span className={classes.noticeIcon} data-rough><IconCheck size={18}/></span>
                            {t`Your order details have been updated. A confirmation email has been sent to the new email address.`}
                        </div>
                    )}

                    <div className={classes.columns}>
                        {hasTickets && (
                            <div className={classes.tickets}>
                                {attendees.map((attendee) => (
                                    <ConfirmationTicket key={attendee.id} attendee={attendee} event={event}/>
                                ))}
                            </div>
                        )}

                        <ConfirmationActions
                            event={event}
                            order={order}
                            ticketsUrl={ticketsUrl}
                            mapsUrl={venue?.mapsUrl || null}
                            className={classes.mobileOnly}
                        />

                        <div className={classes.details}>
                            {isAwaitingPayment && !!event.settings?.offline_payment_instructions && (
                                <HtmlCard title={t`Payment Instructions`} html={event.settings.offline_payment_instructions}/>
                            )}

                            {order.deposit_status === 'PENDING' && !!order.deposit_amount && order.deposit_amount > 0 && (
                                <Card title={t`Security Deposit`}>
                                    <div className={classes.richText}>
                                        <p>
                                            <Trans>
                                                A security deposit of <b>{formatCurrency(order.deposit_amount, event.currency)}</b> must be
                                                sent separately. It is not included in your order total.
                                            </Trans>
                                        </p>
                                        {!!event.settings?.deposit_instructions && (
                                            <div dangerouslySetInnerHTML={{__html: event.settings.deposit_instructions}}/>
                                        )}
                                    </div>
                                </Card>
                            )}

                            <EventCard
                                event={event}
                                order={order}
                                className={hasTickets ? classes.desktopOnly : undefined}
                            />

                            {event.settings?.is_online_event && !!event.settings.online_event_connection_details && (
                                <HtmlCard title={t`Online Event Details`} html={event.settings.online_event_connection_details}/>
                            )}

                            {!!event.settings?.post_checkout_message && (
                                <HtmlCard title={t`Additional Information`} html={event.settings.post_checkout_message}/>
                            )}

                            <OrderRecap order={order}/>

                            {manageActions.length > 0 && (
                                <Card title={t`Manage order`} className={classes.manageCard}>
                                    <div className={classes.actionList}>
                                        {manageActions}
                                    </div>
                                    {isCompleted && allowSelfEdit && (
                                        <p className={classes.tip}>
                                            <PublicIcon name={'etoile'} size={18}/>
                                            {t`Bookmark this page to manage your order anytime.`}
                                        </p>
                                    )}
                                </Card>
                            )}
                        </div>
                    </div>

                    {event.organizer?.id && <OtherEvents organizer={event.organizer} currentEventId={event.id}/>}

                    <PublicPageFooter/>
                </div>
            </div>

            {editingAttendee && (
                <EditAttendeeModal
                    opened={!!editingAttendee}
                    onClose={() => setEditingAttendee(null)}
                    attendee={editingAttendee}
                    onSuccess={(values: any) => {
                        handleEditAttendee(editingAttendee, values);
                    }}
                />
            )}

            {order && (
                <EditOrderModal
                    opened={editOrderModalOpened}
                    onClose={() => setEditOrderModalOpened(false)}
                    order={order}
                    onSuccess={(values: any) => {
                        handleEditOrder(values);
                    }}
                />
            )}
        </>
    );
};

export default OrderSummaryAndProducts;
