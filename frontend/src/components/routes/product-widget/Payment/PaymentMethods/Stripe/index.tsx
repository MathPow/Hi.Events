import {useParams} from "react-router";
import {useCreateStripePaymentIntent} from "../../../../../../queries/useCreateStripePaymentIntent.ts";
import {useEffect, useState} from "react";
import {Appearance, loadStripe, Stripe} from "@stripe/stripe-js";
import {useGetEventPublic} from "../../../../../../queries/useGetEventPublic.ts";
import {t} from "@lingui/macro";
import {eventHomepagePath} from "../../../../../../utilites/urlHelper.ts";
import {LoadingMask} from "../../../../../common/LoadingMask";
import {Elements} from "@stripe/react-stripe-js";
import StripeCheckoutForm from "../../../../../forms/StripeCheckoutForm";
import {Event} from "../../../../../../types.ts";
import classes from "../../Payment.module.scss";

interface StripePaymentMethodProps {
    enabled: boolean;
    setSubmitHandler: (submitHandler: () => () => Promise<void>) => void;
    // Le paiement en ligne est impossible (organisateur pas configure...): la page grise « Payer ».
    onUnavailableChange?: (unavailable: boolean) => void;
}

/* eslint-disable lingui/no-unlocalized-strings */
const ENCRE = '#372721';
const CHAMP = 'rgba(227, 173, 146, 0.3)';

// Le Payment Element aux couleurs de la maquette: champs sur fond sable, libelles gras, coins de 14px.
// Stripe y montre lui-meme Apple Pay ou Google Pay selon l'appareil.
const stripeAppearance = (accent: string): Appearance => ({
    theme: 'stripe',
    variables: {
        colorPrimary: accent,
        colorBackground: '#fffcf8',
        colorText: ENCRE,
        colorTextSecondary: 'rgba(55, 39, 33, 0.7)',
        colorTextPlaceholder: 'rgba(55, 39, 33, 0.5)',
        colorDanger: '#c0392b',
        fontFamily: 'Allotrope, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSizeBase: '16px',
        borderRadius: '14px',
        spacingUnit: '4px',
    },
    rules: {
        '.Label': {
            color: ENCRE,
            fontSize: '15px',
            fontWeight: '700',
            marginBottom: '8px',
        },
        '.Input': {
            padding: '16px 18px',
            border: '1.5px solid transparent',
            boxShadow: 'none',
            backgroundColor: CHAMP,
            fontSize: '17px',
        },
        '.Input:focus': {
            borderColor: accent,
            boxShadow: 'none',
        },
        '.Input--invalid': {
            borderColor: '#c0392b',
            boxShadow: 'none',
        },
        '.AccordionItem': {
            border: 'none',
            boxShadow: 'none',
            backgroundColor: '#fff6ed',
            padding: '18px 22px',
        },
        '.Tab': {
            border: 'none',
            boxShadow: 'none',
            backgroundColor: CHAMP,
        },
        '.Tab--selected': {
            color: '#fff6ed',
            backgroundColor: ENCRE,
        },
    },
});
/* eslint-enable lingui/no-unlocalized-strings */

export const StripePaymentMethod = ({enabled, setSubmitHandler, onUnavailableChange}: StripePaymentMethodProps) => {
    const {eventId, orderShortId} = useParams();
    const {
        data: stripeData,
        isFetched: isStripeFetched,
        error: stripePaymentIntentError
    } = useCreateStripePaymentIntent(eventId, orderShortId);
    const [stripePromise, setStripePromise] = useState<Promise<Stripe | null>>();
    const {data: event} = useGetEventPublic(eventId);

    useEffect(() => {
        if (!stripeData?.client_secret || !stripeData?.public_key) {
            return;
        }

        const stripeAccount = stripeData?.account_id;
        const options = stripeAccount ? {
            stripeAccount: stripeAccount
        } : {};

        setStripePromise(loadStripe(stripeData.public_key, options));
    }, [stripeData]);

    useEffect(() => {
        onUnavailableChange?.(!enabled || !!stripePaymentIntentError);
    }, [enabled, stripePaymentIntentError, onUnavailableChange]);

    if (!enabled) {
        return (
            <div className={classes.stripeError} data-rough>
                <p className={classes.stripeErrorTitle}>{t`Payments not available`}</p>
                <p>{t`Stripe payments are not enabled for this event.`}</p>
                {event && <a href={eventHomepagePath(event as Event)}>{t`Return to Event`}</a>}
            </div>
        );
    }

    if (stripePaymentIntentError && event) {
        return (
            <div className={classes.stripeError} data-rough role="alert">
                <p className={classes.stripeErrorTitle}>
                    {(stripePaymentIntentError as any).response?.data?.message || t`Something went wrong`}
                </p>
                <p>{t`Please restart the checkout process.`}</p>
                <a href={eventHomepagePath(event)}>{t`Return to Event`}</a>
            </div>
        );
    }

    if (!isStripeFetched) {
        return <LoadingMask/>;
    }

    // Toujours le theme clair: la caisse suit la maquette Dehors, seule la couleur principale change.
    const accent = event?.settings?.homepage_theme_settings?.accent || '#fa7853';

    return (
        <>
            {(!stripePromise) && <LoadingMask/>}

            {(isStripeFetched && stripeData?.client_secret && stripePromise) && (
                <Elements options={{
                    clientSecret: stripeData?.client_secret,
                    loader: 'always',
                    appearance: stripeAppearance(accent),
                }} stripe={stripePromise}>
                    <StripeCheckoutForm setSubmitHandler={setSubmitHandler} />
                </Elements>
            )}
        </>
    );
}
