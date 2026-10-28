import React, {useState} from "react";
import {useNavigate, useParams} from "react-router";
import {useGetEventPublic} from "../../../../queries/useGetEventPublic.ts";
import {StripePaymentMethod} from "./PaymentMethods/Stripe";
import {OfflinePaymentMethod} from "./PaymentMethods/Offline";
import {Event} from "../../../../types.ts";
import {Button, Skeleton} from "@mantine/core";
import {IconBuildingBank, IconWallet} from "@tabler/icons-react";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {t, Trans} from "@lingui/macro";
import {useGetOrderPublic} from "../../../../queries/useGetOrderPublic.ts";
import {
    useTransitionOrderToOfflinePaymentPublic
} from "../../../../mutations/useTransitionOrderToOfflinePaymentPublic.ts";
import {DepositInstructions} from "../../../common/DepositInstructions";
import {HomepageInfoMessage} from "../../../common/HomepageInfoMessage";
import {PublicIcon} from "../../../common/PublicIcon";
import {
    CheckoutActions,
    checkoutClasses,
    CheckoutColumns,
    CheckoutSection,
} from "../../../layouts/Checkout/CheckoutColumns";
import {CheckoutOrderPanel} from "../../../layouts/Checkout/CheckoutOrderPanel";
import {showError} from "../../../../utilites/notifications.tsx";
import {getConfig} from "../../../../utilites/config.ts";
import {eventCheckoutPath, eventHomepagePath} from "../../../../utilites/urlHelper.ts";
import classes from "./Payment.module.scss";
import {trackEvent, AnalyticsEvents} from "../../../../utilites/analytics.ts";

const Payment = () => {
    const navigate = useNavigate();
    const {eventId, orderShortId} = useParams();
    const {data: event, isFetched: isEventFetched} = useGetEventPublic(eventId);
    const {data: order, isFetched: isOrderFetched} = useGetOrderPublic(eventId, orderShortId, ['event']);
    const isLoading = !isOrderFetched;
    const checkoutEvent = order?.event || event;
    const [isPaymentLoading, setIsPaymentLoading] = useState(false);
    const [activePaymentMethod, setActivePaymentMethod] = useState<'STRIPE' | 'OFFLINE' | null>(null);
    const [submitHandler, setSubmitHandler] = useState<(() => Promise<void>) | null>(null);
    const transitionOrderToOfflinePaymentMutation = useTransitionOrderToOfflinePaymentPublic();

    const isStripeEnabled = event?.settings?.payment_providers?.includes('STRIPE');
    const isOfflineEnabled = event?.settings?.payment_providers?.includes('OFFLINE');

    React.useEffect(() => {
        // Automatically set the first available payment method
        if (isStripeEnabled) {
            setActivePaymentMethod('STRIPE');
        } else if (isOfflineEnabled) {
            setActivePaymentMethod('OFFLINE');
        } else {
            setActivePaymentMethod(null); // No methods available
        }
    }, [isStripeEnabled, isOfflineEnabled]);

    React.useEffect(() => {
        // Scroll to top when payment page loads
        window?.scrollTo(0, 0);
    }, []);

    const handleParentSubmit = () => {
        if (submitHandler) {
            setIsPaymentLoading(true);
            submitHandler().finally(() => setIsPaymentLoading(false));
        }
    };

    const handleSubmit = async () => {
        if (activePaymentMethod === 'STRIPE') {
            handleParentSubmit();
        } else if (activePaymentMethod === 'OFFLINE') {
            setIsPaymentLoading(true);

            await transitionOrderToOfflinePaymentMutation.mutateAsync({
                eventId,
                orderShortId
            }, {
                onSuccess: () => {
                    const totalCents = Math.round((order?.total_gross || 0) * 100);
                    trackEvent(AnalyticsEvents.PURCHASE_COMPLETED_OFFLINE, { value: totalCents });
                    navigate(`/checkout/${eventId}/${orderShortId}/summary`);
                },
                onError: (error: any) => {
                    setIsPaymentLoading(false);
                    showError(error.response?.data?.message || t`Offline payment failed. Please try again or contact the event organizer.`);
                }
            });
        }
    };

    if (isOrderFetched && !order) {
        return (
            <HomepageInfoMessage
                status="error"
                message={t`Something went wrong`}
                subtitle={t`We hit a snag loading this page. Please try again.`}
                link={event ? eventHomepagePath(event) : undefined}
                linkText={t`Back to Event`}
            />
        );
    }

    if (!order || !checkoutEvent) {
        return (
            <CheckoutColumns panel={<Skeleton height={360} radius={32}/>}>
                <Skeleton height={300} radius={22}/>
            </CheckoutColumns>
        );
    }

    if (order.payment_status === 'PAYMENT_RECEIVED') {
        return (
            <HomepageInfoMessage
                status="success"
                message={t`Payment received`}
                subtitle={t`This order has already been paid.`}
                linkText={t`View Order Details`}
                link={eventCheckoutPath(eventId, orderShortId, 'summary')}
            />
        );
    }

    // Le formulaire Stripe ne sert qu'a une commande qui attend encore son paiement.
    if (isStripeEnabled && order.payment_status
        && order.payment_status !== 'AWAITING_PAYMENT' && order.payment_status !== 'PAYMENT_FAILED') {
        return (
            <HomepageInfoMessage
                status="expired"
                message={t`Page no longer available`}
                subtitle={t`This order page is no longer available.`}
                linkText={t`Back to Event`}
                link={eventHomepagePath(checkoutEvent as Event)}
            />
        );
    }

    const noPaymentMethods = !isStripeEnabled && !isOfflineEnabled && isOrderFetched && isEventFetched;
    const attendeeNames = (order.attendees ?? [])
        .map(attendee => `${attendee.first_name ?? ''} ${attendee.last_name ?? ''}`.trim())
        .filter(Boolean);
    const buyer = [`${order.first_name ?? ''} ${order.last_name ?? ''}`.trim(), order.email].filter(Boolean).join(' · ');

    return (
        <CheckoutColumns panel={<CheckoutOrderPanel event={checkoutEvent} order={order}/>}>
            {/* Les etapes deja remplies, rappelees en une ligne. */}
            <div className={classes.completedSteps}>
                <CheckoutSection number={1} title={t`Your contact details`} subtitle={buyer}/>
                {attendeeNames.length > 0 && (
                    <CheckoutSection number={2} title={t`Attendees`} subtitle={attendeeNames.join(', ')}/>
                )}
            </div>

            <CheckoutSection number={attendeeNames.length > 0 ? 3 : 2} title={t`Payment`}>
                {noPaymentMethods && (
                    <p className={classes.noMethods}>
                        {t`No payment methods are currently available. Please contact the event organizer for assistance.`}
                    </p>
                )}

                {(isStripeEnabled && isOfflineEnabled) && (
                    <div className={classes.paymentMethodTabs} role="group" aria-label={t`Payment method`}>
                        <button
                            type="button"
                            className={classes.paymentMethodTab}
                            data-active={activePaymentMethod === 'STRIPE' || undefined}
                            aria-pressed={activePaymentMethod === 'STRIPE'}
                            onClick={() => setActivePaymentMethod('STRIPE')}
                        >
                            <IconWallet size={18}/>
                            <span>{t`Online`}</span>
                        </button>
                        <button
                            type="button"
                            className={classes.paymentMethodTab}
                            data-active={activePaymentMethod === 'OFFLINE' || undefined}
                            aria-pressed={activePaymentMethod === 'OFFLINE'}
                            onClick={() => setActivePaymentMethod('OFFLINE')}
                        >
                            <IconBuildingBank size={18}/>
                            <span>{t`Offline`}</span>
                        </button>
                    </div>
                )}

                {isStripeEnabled && (
                    <div style={{display: activePaymentMethod === 'STRIPE' ? 'block' : 'none'}}>
                        <StripePaymentMethod enabled={true} setSubmitHandler={setSubmitHandler}/>
                    </div>
                )}

                {isOfflineEnabled && (
                    <div style={{display: activePaymentMethod === 'OFFLINE' ? 'block' : 'none'}}>
                        <OfflinePaymentMethod event={checkoutEvent as Event}/>
                    </div>
                )}

                {!!order.deposit_amount && order.deposit_amount > 0 && (
                    <div className={`${checkoutClasses.embedded} ${classes.deposit}`}>
                        <DepositInstructions event={checkoutEvent as Event} order={order}/>
                    </div>
                )}
            </CheckoutSection>

            {!noPaymentMethods && (
                <CheckoutActions>
                    <Button
                        className={checkoutClasses.primaryButton}
                        loading={isLoading || isPaymentLoading}
                        onClick={handleSubmit}
                        leftSection={<PublicIcon name={'cadenas'} size={20}/>}
                    >
                        {order.is_payment_required
                            ? `${t`Pay`} ${formatCurrency(order.total_gross, order.currency)}`
                            : t`Complete Payment`}
                    </Button>
                    {activePaymentMethod === 'STRIPE' && (
                        <p className={checkoutClasses.actionsNote}>
                            <span className={checkoutClasses.desktopOnly}>
                                {t`Secure payment by Stripe. Card details are never stored by the ticketing service.`}
                            </span>
                            <span className={checkoutClasses.mobileOnly}>
                                {t`Secure payment by Stripe`}
                            </span>
                        </p>
                    )}
                    {getConfig('VITE_TOS_URL') && (
                        <p className={checkoutClasses.actionsNote}>
                            <Trans>
                                By continuing, you agree to the{' '}
                                <a
                                    href={getConfig('VITE_TOS_URL', 'https://hi.events/terms-of-service') as string}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {getConfig('VITE_APP_NAME', 'Hi.Events')} Terms of Service
                                </a>
                            </Trans>
                        </p>
                    )}
                </CheckoutActions>
            )}
        </CheckoutColumns>
    );
}

export default Payment;
