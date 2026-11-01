import {Navigate, useLocation, useParams} from "react-router";
import {t} from "@lingui/macro";
import {useAutosaveStatus, usePageDetail} from "../../../layouts/AppLayout/PageStatus.tsx";
import {OrganizationTab} from "./tabs/OrganizationTab.tsx";
import {PaymentsTab} from "./tabs/PaymentsTab.tsx";
import {TaxesTab} from "./tabs/TaxesTab.tsx";
import {EmailsTab} from "./tabs/EmailsTab.tsx";
import {TeamTab} from "./tabs/TeamTab.tsx";
import {SETTINGS_TABS, SettingsTab, settingsTabLabel, settingsTabPath} from "./settingsTabs.ts";
import classes from "./Settings.module.scss";

const tabSubtitle = (tab: SettingsTab) => ({
    organization: t`Your organization's details, its address and its social networks.`,
    payments: t`Your Stripe account and the fees at checkout.`,
    taxes: t`The taxes and fees added to your prices, and tax receipts.`,
    emails: t`The emails sent to your buyers.`,
    team: t`Who can manage your events, and API tokens.`,
})[tab];

/**
 * Figma « Admin · Paramètres »: the organizer's and the account's settings, one section per page,
 * each opened from the account menu (the profile button). Every field saves itself when it is left
 * (« Changements enregistrés » in the top bar).
 */
const Settings = () => {
    const {organizerId, tab} = useParams();
    const location = useLocation();
    // Stripe brings the organizer back to /settings?stripe_return=1 at the end of its setup.
    const backFromStripe = /[?&]stripe_(return|refresh)=1/.test(location.search);
    const isKnownTab = SETTINGS_TABS.includes(tab as SettingsTab);
    const active: SettingsTab = isKnownTab ? tab as SettingsTab : (backFromStripe ? 'payments' : 'organization');

    usePageDetail(settingsTabLabel(active));
    // The whole page saves by itself: « Changements enregistrés » on every tab.
    useAutosaveStatus();

    if (!organizerId) {
        return null;
    }

    if (tab && !isKnownTab) {
        return <Navigate to={settingsTabPath(organizerId, 'organization')} replace/>;
    }

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <h1 className={classes.title}>{settingsTabLabel(active)}</h1>
                <p className={classes.subtitle}>{tabSubtitle(active)}</p>
            </header>

            {active === 'organization' && <OrganizationTab key={organizerId} organizerId={organizerId}/>}
            {active === 'payments' && <PaymentsTab key={organizerId} organizerId={organizerId}/>}
            {active === 'taxes' && <TaxesTab key={organizerId} organizerId={organizerId}/>}
            {active === 'emails' && <EmailsTab key={organizerId} organizerId={organizerId}/>}
            {active === 'team' && <TeamTab/>}
        </div>
    );
};

export default Settings;
