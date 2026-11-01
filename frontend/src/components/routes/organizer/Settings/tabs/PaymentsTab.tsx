import {useState} from "react";
import {t} from "@lingui/macro";
import {IdParam, OrganizerSettings} from "../../../../../types.ts";
import {useGetAccount} from "../../../../../queries/useGetAccount.ts";
import {useGetOrganizer} from "../../../../../queries/useGetOrganizer.ts";
import {useGetOrganizerSettings} from "../../../../../queries/useGetOrganizerSettings.ts";
import {useGetStripeConnectAccounts} from "../../../../../queries/useGetStripeConnectAccounts.ts";
import {useUpdateOrganizerSettings} from "../../../../../mutations/useUpdateOrganizerSettings.ts";
import {useIsCurrentUserAdmin} from "../../../../../hooks/useIsCurrentUserAdmin.ts";
import {isHiEvents} from "../../../../../utilites/helpers.ts";
import {platformSupportEnabled} from "../../../../common/PlatformSupportInput";
import {useSectionAutosave} from "../../../../layouts/AppLayout/PageStatus.tsx";
import {VatSettings} from "../../../account/ManageAccount/sections/PaymentSettings/VatSettings";
import {getVatInfo} from "../../../account/ManageAccount/sections/PaymentSettings/VatNotice";
import {StripeCard} from "../payments/StripeCard.tsx";
import {FeesCard} from "../payments/FeesCard.tsx";
import {SettingsCard, ToggleRow} from "../SettingsUi.tsx";
import {SettingsSkeleton} from "./OrganizationTab.tsx";
import classes from "../Settings.module.scss";

// Up to this fee rate included, the buyers' contribution is always offered and the organizer has no
// say (PlatformSupportService::ALWAYS_ON_UP_TO_FEE_PERCENT).
const PLATFORM_SUPPORT_ALWAYS_ON_UP_TO_FEE_PERCENT = 1.5;

const PlatformSupportCard = ({organizerId, settings}: { organizerId: IdParam, settings: OrganizerSettings }) => {
    const updateSettings = useUpdateOrganizerSettings();
    const [enabled, setEnabled] = useState(settings.platform_support_enabled ?? true);
    const queue = useSectionAutosave<OrganizerSettings>('platform-support', (changes) => updateSettings.mutateAsync({
        organizerId,
        organizerSettings: changes,
    }));

    return (
        <SettingsCard
            title={t`Platform contribution`}
            subtitle={t`At checkout, buyers can add an optional contribution to support the ticketing platform. Turn it off to remove it from your events' checkout.`}
        >
            <ToggleRow
                label={t`Offer the platform contribution at checkout`}
                checked={enabled}
                onChange={(checked) => {
                    setEnabled(checked);
                    queue({platform_support_enabled: checked});
                }}
            />
        </SettingsCard>
    );
};

// « Paiements »: where the money goes (Stripe) and who pays the fees.
export const PaymentsTab = ({organizerId}: { organizerId: IdParam }) => {
    const {data: account} = useGetAccount();
    const {data: organizer} = useGetOrganizer(organizerId);
    const {data: settings} = useGetOrganizerSettings(organizerId);
    const isAdmin = useIsCurrentUserAdmin();
    const showVat = isHiEvents() && isAdmin;
    const stripeAccounts = useGetStripeConnectAccounts(account?.id || 0, {enabled: showVat && !!account?.id});

    if (!account || !organizer || !settings) {
        return <SettingsSkeleton/>;
    }

    const feePercentage = Number(account.configuration?.application_fees?.percentage ?? 0);
    const platformSupportChoice = platformSupportEnabled() && feePercentage > PLATFORM_SUPPORT_ALWAYS_ON_UP_TO_FEE_PERCENT;
    const stripeCountry = stripeAccounts.data?.stripe_connect_accounts.find(stripeAccount => stripeAccount.is_setup_complete)?.country;

    return (
        <div className={classes.grid}>
            <StripeCard organizerId={organizerId} account={account} isAdmin={isAdmin}/>
            <FeesCard organizerId={organizerId} account={account} settings={settings} currency={organizer.currency || account.currency_code || 'CAD'}/>
            {platformSupportChoice && <PlatformSupportCard organizerId={organizerId} settings={settings}/>}
            {showVat && getVatInfo(stripeCountry).isEU && (
                <SettingsCard full title={t`VAT Information`}>
                    <VatSettings account={account} stripeCountry={stripeCountry}/>
                </SettingsCard>
            )}
        </div>
    );
};
