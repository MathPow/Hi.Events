import {useEffect, useRef, useState} from "react";
import {useParams} from "react-router";
import {Alert, Badge, Button, Group, Text} from "@mantine/core";
import {IconAlertCircle, IconBrandStripe, IconCheck, IconInfoCircle} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {Card} from "../../../../../common/Card";
import {HeadingWithDescription} from "../../../../../common/Card/CardHeading";
import {useGetOrganizerStripeConnection} from "../../../../../../queries/useGetOrganizerStripeConnection.ts";
import {useConnectOrganizerStripe} from "../../../../../../mutations/useConnectOrganizerStripe.ts";
import {useDisconnectOrganizerStripe} from "../../../../../../mutations/useDisconnectOrganizerStripe.ts";
import {showError, showSuccess} from "../../../../../../utilites/notifications.tsx";

/**
 * Compte Stripe propre a l'organisateur. Sans lui, les ventes sont encaissees
 * sur le compte de la billetterie: c'est un repli, pas une destination.
 */
export const PaymentSettings = () => {
    const {organizerId} = useParams();
    const [isReturningFromStripe, setIsReturningFromStripe] = useState(false);
    const hasCheckedReturn = useRef(false);

    // Stripe renvoie ici a la fin de l'onboarding. On relit l'etat chez lui a ce
    // moment: le webhook peut manquer, et la page afficherait alors une
    // configuration inachevee alors qu'elle est terminee.
    useEffect(() => {
        if (typeof window === 'undefined' || hasCheckedReturn.current) {
            return;
        }

        hasCheckedReturn.current = true;
        const params = new URLSearchParams(window.location.search);

        if (params.get('stripe_return') === '1' || params.get('stripe_refresh') === '1') {
            setIsReturningFromStripe(true);
            params.delete('stripe_return');
            params.delete('stripe_refresh');
            const query = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
        }
    }, []);

    const connectionQuery = useGetOrganizerStripeConnection(organizerId, isReturningFromStripe);
    const connectMutation = useConnectOrganizerStripe();
    const disconnectMutation = useDisconnectOrganizerStripe();

    const connection = connectionQuery.data?.data;

    const handleConnect = () => {
        connectMutation.mutate(organizerId, {
            onSuccess: (response) => {
                if (response.data.connect_url) {
                    window.location.href = response.data.connect_url;
                    return;
                }

                showSuccess(t`This organizer is already connected to Stripe.`);
            },
            onError: (error: any) => showError(
                error.response?.data?.message || t`Could not start the Stripe setup. Please try again.`
            ),
        });
    };

    const handleDisconnect = () => {
        if (!window.confirm(t`Disconnect this Stripe account? New sales will be paid to the platform account instead.`)) {
            return;
        }

        disconnectMutation.mutate(organizerId, {
            onSuccess: () => showSuccess(t`Stripe account disconnected`),
            onError: () => showError(t`Could not disconnect the Stripe account.`),
        });
    };

    return (
        <Card>
            <HeadingWithDescription
                heading={t`Payments`}
                description={t`Where the money from this organizer's ticket sales is paid.`}
            />

            {connection?.is_setup_complete && (
                <>
                    <Group gap="xs" mb="md">
                        <Badge color="green" leftSection={<IconCheck size={12}/>}>{t`Connected`}</Badge>
                        <Text size="sm" c="dimmed">{connection.stripe_account_id}</Text>
                    </Group>
                    <Text size="sm" c="dimmed" mb="md">
                        {t`Ticket sales for this organizer are paid directly into this Stripe account.`}
                    </Text>
                    <Button
                        variant="subtle"
                        color="red"
                        size="sm"
                        onClick={handleDisconnect}
                        loading={disconnectMutation.isPending}
                    >
                        {t`Disconnect Stripe`}
                    </Button>
                </>
            )}

            {connection && !connection.is_setup_complete && (
                <>
                    <Alert icon={<IconInfoCircle size={16}/>} color="blue" mb="md">
                        {connection.is_connected
                            ? t`Stripe setup is not finished yet. Until it is, sales are paid to the platform account.`
                            : t`No Stripe account is connected. Sales are paid to the platform account until one is.`}
                    </Alert>
                    <Button
                        variant="light"
                        size="sm"
                        leftSection={<IconBrandStripe size={16}/>}
                        onClick={handleConnect}
                        loading={connectMutation.isPending}
                    >
                        {connection.is_connected ? t`Finish Stripe setup` : t`Connect Stripe`}
                    </Button>
                </>
            )}

            {connectionQuery.isError && (
                <Alert icon={<IconAlertCircle size={16}/>} color="red">
                    {t`Could not read the Stripe status for this organizer.`}
                </Alert>
            )}
        </Card>
    );
};

export default PaymentSettings;
