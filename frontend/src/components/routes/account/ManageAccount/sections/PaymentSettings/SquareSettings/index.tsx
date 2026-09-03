import {useEffect, useRef, useState} from "react";
import {Badge, Button, Group, Select, Text, ThemeIcon, Title} from "@mantine/core";
import {IconAlertCircle, IconBuildingStore, IconCheck} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {Card} from "../../../../../../common/Card";
import {IdParam} from "../../../../../../../types.ts";
import {useGetSquareConnection} from "../../../../../../../queries/useGetSquareConnection.ts";
import {useCreateSquareAuthorizationUrl} from "../../../../../../../mutations/useCreateSquareAuthorizationUrl.ts";
import {useCompleteSquareAuthorization} from "../../../../../../../mutations/useCompleteSquareAuthorization.ts";
import {useUpdateSquareLocation} from "../../../../../../../mutations/useUpdateSquareLocation.ts";
import {useDisconnectSquare} from "../../../../../../../mutations/useDisconnectSquare.ts";
import {showError, showSuccess} from "../../../../../../../utilites/notifications.tsx";

interface SquareSettingsProps {
    accountId: IdParam;
}

export const SquareSettings = ({accountId}: SquareSettingsProps) => {
    const connectionQuery = useGetSquareConnection(accountId);
    const authorizationMutation = useCreateSquareAuthorizationUrl();
    const completeMutation = useCompleteSquareAuthorization();
    const locationMutation = useUpdateSquareLocation();
    const disconnectMutation = useDisconnectSquare();
    const hasHandledReturn = useRef(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const connection = connectionQuery.data?.data;

    // Retour d'autorisation: Square renvoie sur cette page avec un code et le
    // state qu'on lui avait confie. On l'echange puis on nettoie l'URL, pour
    // qu'un rechargement ne rejoue pas un code deja consomme.
    useEffect(() => {
        if (typeof window === 'undefined' || hasHandledReturn.current) {
            return;
        }

        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');

        if (!code || !state || !accountId) {
            return;
        }

        hasHandledReturn.current = true;

        completeMutation.mutate({accountId, code, state}, {
            onSuccess: () => showSuccess(t`Square account connected`),
            onError: (error: any) => showError(
                error.response?.data?.errors?.code?.[0]
                || error.response?.data?.message
                || t`Square refused the authorization. Please try again.`
            ),
            onSettled: () => {
                params.delete('code');
                params.delete('state');
                params.delete('response_type');
                const query = params.toString();
                window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
            },
        });
    }, [accountId]);

    const handleConnect = () => {
        setIsRedirecting(true);

        authorizationMutation.mutate(accountId, {
            onSuccess: (response) => {
                window.location.href = response.data.authorize_url;
            },
            onError: (error: any) => {
                setIsRedirecting(false);
                showError(error.response?.data?.message || t`Could not start the Square authorization.`);
            },
        });
    };

    const handleDisconnect = () => {
        if (!window.confirm(t`Disconnect Square? Events using it will stop accepting card payments.`)) {
            return;
        }

        disconnectMutation.mutate(accountId, {
            onSuccess: () => showSuccess(t`Square account disconnected`),
            onError: () => showError(t`Could not disconnect the Square account.`),
        });
    };

    const handleLocationChange = (locationId: string | null) => {
        if (!locationId) {
            return;
        }

        locationMutation.mutate({accountId, locationId}, {
            onSuccess: () => showSuccess(t`Square location saved`),
            onError: (error: any) => showError(
                error.response?.data?.errors?.location_id?.[0]
                || t`Could not save the Square location.`
            ),
        });
    };

    // Sans identifiants d'application, l'autorisation ne peut pas aboutir: mieux
    // vaut ne rien proposer que d'offrir un bouton qui echoue.
    if (!connection?.is_oauth_configured) {
        return null;
    }

    return (
        <Card>
            <Group gap="sm" mb="md" justify="space-between">
                <Group gap="sm">
                    <ThemeIcon size="md" variant="light" radius="xl" color={connection.is_setup_complete ? 'green' : 'gray'}>
                        {connection.is_setup_complete ? <IconCheck size={16}/> : <IconBuildingStore size={16}/>}
                    </ThemeIcon>
                    <div>
                        <Title order={4}>{t`Square`}</Title>
                        {connection.merchant_name && (
                            <Text size="xs" c="dimmed">{connection.merchant_name}</Text>
                        )}
                    </div>
                </Group>
                {connection.environment === 'sandbox' && (
                    <Badge color="orange" size="sm">{t`Sandbox`}</Badge>
                )}
            </Group>

            {!connection.is_connected && (
                <>
                    <Text size="sm" c="dimmed" mb="md">
                        {t`Connect your Square account to accept card payments. Payouts go straight to your Square balance.`}
                    </Text>
                    <Button
                        variant="light"
                        size="sm"
                        leftSection={<IconBuildingStore size={16}/>}
                        onClick={handleConnect}
                        loading={isRedirecting || completeMutation.isPending}
                    >
                        {t`Connect with Square`}
                    </Button>
                </>
            )}

            {connection.is_connected && (
                <>
                    {!connection.is_setup_complete && (
                        <Group gap="xs" mb="md" wrap="nowrap">
                            <ThemeIcon size="sm" variant="light" radius="xl" color="orange">
                                <IconAlertCircle size={14}/>
                            </ThemeIcon>
                            <Text size="sm" c="dimmed">
                                {t`Choose which location takes the payments to finish the setup.`}
                            </Text>
                        </Group>
                    )}

                    <Select
                        label={t`Location`}
                        description={t`Payments are recorded against this Square location.`}
                        placeholder={t`Select a location`}
                        value={connection.location_id}
                        onChange={handleLocationChange}
                        disabled={locationMutation.isPending}
                        mb="md"
                        data={connection.locations.map((location) => ({
                            value: location.id,
                            label: location.is_active
                                ? location.name
                                : `${location.name} (${t`inactive`})`,
                            disabled: !location.is_active,
                        }))}
                    />

                    <Group gap="xs">
                        <Button
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={handleDisconnect}
                            loading={disconnectMutation.isPending}
                        >
                            {t`Disconnect Square`}
                        </Button>
                    </Group>
                </>
            )}
        </Card>
    );
};
