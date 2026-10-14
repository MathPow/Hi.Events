import {t} from "@lingui/macro";
import {useParams} from "react-router";
import {useEffect, useState} from "react";
import {Switch} from "@mantine/core";
import {Card} from "../../../../../common/Card";
import {HeadingWithDescription} from "../../../../../common/Card/CardHeading";
import {useGetOrganizerSettings} from "../../../../../../queries/useGetOrganizerSettings.ts";
import {useUpdateOrganizerSettings} from "../../../../../../mutations/useUpdateOrganizerSettings.ts";
import {showError, showSuccess} from "../../../../../../utilites/notifications.tsx";

export const PlatformSupportSettings = () => {
    const {organizerId} = useParams();
    const settingsQuery = useGetOrganizerSettings(organizerId);
    const updateMutation = useUpdateOrganizerSettings();
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        if (settingsQuery.isFetched && settingsQuery.data) {
            setEnabled(settingsQuery.data.platform_support_enabled ?? true);
        }
    }, [settingsQuery.isFetched, settingsQuery.data]);

    const handleChange = (value: boolean) => {
        setEnabled(value);
        updateMutation.mutate({
            organizerId,
            organizerSettings: {platform_support_enabled: value},
        }, {
            onSuccess: () => showSuccess(value
                ? t`Platform contribution enabled`
                : t`Platform contribution disabled`),
            onError: () => {
                setEnabled(!value);
                showError(t`Something went wrong. Please try again.`);
            },
        });
    };

    return (
        <Card>
            <HeadingWithDescription
                heading={t`Platform contribution`}
                description={t`At checkout, buyers can add an optional contribution to support the ticketing platform. Turn it off to remove it from your events' checkout.`}
            />
            <Switch
                checked={enabled}
                onChange={(event) => handleChange(event.currentTarget.checked)}
                disabled={settingsQuery.isLoading || updateMutation.isPending}
                label={t`Offer the platform contribution at checkout`}
            />
        </Card>
    );
};
