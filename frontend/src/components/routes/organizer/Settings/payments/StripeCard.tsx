import {useEffect, useRef, useState} from "react";
import {t} from "@lingui/macro";
import {Button} from "@mantine/core";
import {useQueryClient} from "@tanstack/react-query";
import {Account, IdParam} from "../../../../../types.ts";
import {useGetOrganizerStripeConnection} from "../../../../../queries/useGetOrganizerStripeConnection.ts";
import {useConnectOrganizerStripe} from "../../../../../mutations/useConnectOrganizerStripe.ts";
import {useDisconnectOrganizerStripe} from "../../../../../mutations/useDisconnectOrganizerStripe.ts";
import {GET_ACCOUNT_QUERY_KEY} from "../../../../../queries/useGetAccount.ts";
import {useCreateOrGetStripeConnectDetails} from "../../../../../queries/useCreateOrGetStripeConnectDetails.ts";
import {showError, showSuccess} from "../../../../../utilites/notifications.tsx";
import {confirmationDialog} from "../../../../../utilites/confirmationDialog.tsx";
import {AnalyticsEvents, trackEvent} from "../../../../../utilites/analytics.ts";
import {StripeConnectButton} from "../../../../common/StripeConnectButton";
import {SettingsCard, Tag} from "../SettingsUi.tsx";
import classes from "../Settings.module.scss";

// Stripe sends back here at the end of its setup: ?stripe_return (the organizer's own Stripe) or
// ?is_return (the account's, through /account/payment). The parameters are removed once read.
const useStripeReturn = () => {
    const [returning, setReturning] = useState<{ organizer: boolean, account: boolean }>({organizer: false, account: false});
    const checked = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined' || checked.current) {
            return;
        }
        checked.current = true;
        const params = new URLSearchParams(window.location.search);
        const organizer = params.get('stripe_return') === '1' || params.get('stripe_refresh') === '1';
        const account = params.has('is_return') || params.has('is_refresh');
        if (!organizer && !account) {
            return;
        }
        setReturning({organizer, account});
        ['stripe_return', 'stripe_refresh', 'is_return', 'is_refresh'].forEach(name => params.delete(name));
        const query = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
    }, []);

    return returning;
};

interface StripeCardProps {
    organizerId: IdParam;
    account: Account;
    isAdmin: boolean;
}

/**
 * « Compte Stripe »: where the money of the sales goes. The organizer's own Stripe first, else the
 * account's (the usual case, the one that also unlocks emails and messages), else the ticketing
 * platform's account when our team allows it; otherwise card payments are off.
 */
export const StripeCard = ({organizerId, account, isAdmin}: StripeCardProps) => {
    const queryClient = useQueryClient();
    const returning = useStripeReturn();
    const isSaas = !!account.is_saas_mode_enabled;
    const connectionQuery = useGetOrganizerStripeConnection(isAdmin ? organizerId : undefined, returning.organizer);
    const connectMutation = useConnectOrganizerStripe();
    const disconnectMutation = useDisconnectOrganizerStripe();
    const tracked = useRef(false);

    // Back from the account's Stripe setup: ask Stripe where it stands, then reload the account.
    const accountSync = useCreateOrGetStripeConnectDetails(account.id ?? '', returning.account && isSaas && isAdmin && !!account.id);
    useEffect(() => {
        if (!accountSync.data) {
            return;
        }
        queryClient.invalidateQueries({queryKey: [GET_ACCOUNT_QUERY_KEY]});
        if (accountSync.data.is_connect_setup_complete && !tracked.current) {
            tracked.current = true;
            trackEvent(AnalyticsEvents.STRIPE_CONNECTED);
        }
    }, [accountSync.data]);

    const own = connectionQuery.data?.data;
    const ownAccountId = own?.stripe_account_id ?? '';
    const ownComplete = !!own?.is_setup_complete;
    const ownStarted = !!own?.is_connected && !ownComplete;
    const accountComplete = isSaas && !!account.stripe_connect_setup_complete;
    const accountStarted = isSaas && !!account.stripe_account_id && !accountComplete;
    const connected = ownComplete || accountComplete;
    const paymentsOn = (isSaas && connected) || !!account.platform_payments_allowed;

    const connectOwn = () => connectMutation.mutate(organizerId, {
        onSuccess: (response) => {
            if (response.data.connect_url) {
                window.location.href = response.data.connect_url;
                return;
            }
            showSuccess(t`This organizer is already connected to Stripe.`);
        },
        onError: (error: any) => showError(error.response?.data?.message || t`Could not start the Stripe setup. Please try again.`),
    });

    const disconnectOwn = () => confirmationDialog(
        t`Disconnect this Stripe account? New sales will be paid to the platform account instead.`,
        () => disconnectMutation.mutate(organizerId, {
            onSuccess: () => showSuccess(t`Stripe account disconnected`),
            onError: () => showError(t`Could not disconnect the Stripe account.`),
        }),
        {confirm: t({message: 'Disconnect Stripe', context: 'settings'}), cancel: t`Cancel`},
    );

    const title = connected
        ? t`Connected to Stripe`
        : (ownStarted || accountStarted) ? t`Stripe setup to finish` : t`No account connected`;

    const tag = paymentsOn
        ? (connected ? <Tag tone="green">{t`Payments on`}</Tag> : <Tag tone="yellow">{t`Collected by the ticketing platform`}</Tag>)
        : <Tag tone="yellow">{t`Payments off`}</Tag>;

    // Organizer-level Stripe exists on its own: it works even without Saas mode.
    const viaAccountStripe = isSaas && !own?.is_connected;

    let action = null;
    if (!isAdmin) {
        action = !connected && <p className={classes.softHint}>{t`Only an account administrator can connect Stripe.`}</p>;
    } else if (ownStarted) {
        action = (
            <Button variant="transparent" className={`${classes.inkButton} ${classes.fullWidth}`} onClick={connectOwn} loading={connectMutation.isPending}>
                {t`Finish Stripe Setup`}
            </Button>
        );
    } else if (!connected && viaAccountStripe) {
        action = (
            <StripeConnectButton
                className={`${classes.inkButton} ${classes.fullWidth}`}
                buttonIcon={null}
                variant="transparent"
                buttonText={accountStarted ? t`Finish Stripe Setup` : t`Connect Stripe`}
            />
        );
    } else if (!connected) {
        action = (
            <Button variant="transparent" className={`${classes.inkButton} ${classes.fullWidth}`} onClick={connectOwn} loading={connectMutation.isPending}>
                {t`Connect Stripe`}
            </Button>
        );
    }

    return (
        <SettingsCard title={t`Stripe account`} subtitle={t`Where the money from your sales goes.`}>
            <div className={classes.statusBox}>
                <span className={classes.statusPastille}>
                    <img src="/interface/admin/parametres/carte.svg" alt=""/>
                </span>
                <div className={classes.statusText}>
                    <span className={classes.statusTitle}>{title}</span>
                    {tag}
                </div>
            </div>

            <p className={classes.bodyText}>
                {ownComplete
                    ? t`This organizer's sales are paid directly into its own Stripe account (${ownAccountId}).`
                    : accountComplete
                        ? t`Sales are paid directly into your account's Stripe account, without waiting for the day of the event.`
                        : t`Sales are paid directly into your Stripe account, without waiting for the day of the event.`}
            </p>

            {action}

            {connected && (
                <div className={classes.linkRow}>
                    <a className={classes.textButton} href="https://dashboard.stripe.com/" target="_blank" rel="noopener noreferrer">
                        {t`Open Stripe Dashboard`}
                    </a>
                    {isAdmin && ownComplete && (
                        <button type="button" className={classes.textButton} onClick={disconnectOwn} disabled={disconnectMutation.isPending}>
                            {t({message: 'Disconnect Stripe', context: 'settings'})}
                        </button>
                    )}
                    {isAdmin && accountComplete && !own?.is_connected && (
                        <button type="button" className={classes.textButton} onClick={connectOwn} disabled={connectMutation.isPending}>
                            {t`Use another Stripe account for this organizer`}
                        </button>
                    )}
                </div>
            )}

            {!connected && (
                <p className={`${classes.hint} ${classes.centered}`}>{t`Only free events? No need for Stripe.`}</p>
            )}
        </SettingsCard>
    );
};
