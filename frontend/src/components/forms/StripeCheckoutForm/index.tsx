import {useEffect, useRef, useState} from "react";
import {PaymentElement, useElements, useStripe} from "@stripe/react-stripe-js";
import {useParams} from "react-router";
import * as stripeJs from "@stripe/stripe-js";
import {Alert, Skeleton} from "@mantine/core";
import {t} from "@lingui/macro";
import classes from './StripeCheckoutForm.module.scss';
import {LoadingMask} from "../../common/LoadingMask";
import {useGetOrderPublic} from "../../../queries/useGetOrderPublic.ts";

export default function StripeCheckoutForm({setSubmitHandler}: {
    setSubmitHandler: (submitHandler: () => () => Promise<void>) => void
}) {
    const {eventId, orderShortId} = useParams();
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | undefined>('');
    // « Payer » reste inactif tant que le formulaire de carte n'est pas pret.
    const [isElementReady, setIsElementReady] = useState(false);
    const messageRef = useRef<HTMLDivElement>(null);
    const {data: order, isFetched: isOrderFetched} = useGetOrderPublic(eventId, orderShortId, ['event']);

    const handleSubmit = async () => {
        if (!stripe || !elements) {
            return;
        }

        const {error} = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window?.location.origin + `/checkout/${eventId}/${orderShortId}/payment_return`
            },
        });

        if (error?.type === "card_error" || error?.type === "validation_error") {
            setMessage(error.message);
        } else {
            setMessage(t`An unexpected error occurred.`);
        }
    };

    useEffect(() => {
        if (!stripe) {
            return;
        }

        const clientSecret = new URLSearchParams(window?.location.search).get(
            "payment_intent_client_secret"
        );

        if (!clientSecret) {
            return;
        }

        stripe.retrievePaymentIntent(clientSecret).then(({paymentIntent}) => {
            switch (paymentIntent?.status) {
                case "succeeded":
                    setMessage(t`Payment succeeded!`);
                    break;
                case "processing":
                    setMessage(t`Your payment is processing.`);
                    break;
                case "requires_payment_method":
                    setMessage(t`Your payment was not successful, please try again.`);
                    break;
                default:
                    setMessage(t`Something went wrong.`);
                    break;
            }
        });
    }, [stripe]);

    useEffect(() => {
        if (setSubmitHandler && stripe && elements && isElementReady) {
            setSubmitHandler(() => handleSubmit);
        }
    }, [setSubmitHandler, stripe, elements, isElementReady]);

    // Sur telephone, « Payer » est en bas de l'ecran: le refus de la carte vient a l'acheteur.
    useEffect(() => {
        if (message) {
            messageRef.current?.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
    }, [message]);

    // Une commande deja payee ou qui n'attend plus de paiement: la page Paiement l'annonce elle-meme.
    if (!isOrderFetched || !order?.payment_status) {
        return <Skeleton height={300} radius={22}/>;
    }

    const paymentElementOptions: stripeJs.StripePaymentElementOptions = {
        layout: {
            type: "accordion",
            defaultCollapsed: false,
            radios: false,
            spacedAccordionItems: false,
        },
    };

    return (
        <form id="payment-form">
            <>
                {(order?.payment_status === 'PAYMENT_FAILED' || window?.location.search.includes('payment_failed')) && (
                    <Alert mb={20} color={'red'}>{t`Your payment was unsuccessful. Please try again.`}</Alert>
                )}

                {message !== '' && <Alert ref={messageRef} mb={20} role={'alert'}>{message}</Alert>}
                <LoadingMask/>
                <PaymentElement
                    className={classes.stripeForElement}
                    id="payment-element"
                    options={paymentElementOptions}
                    onReady={() => setIsElementReady(true)}
                    onLoadError={() => setMessage(t`The payment form couldn't load. Check your connection or turn off your ad blocker, then reload the page.`)}
                />
            </>
        </form>
    );
}
