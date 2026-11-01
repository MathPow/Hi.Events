import {useEffect, useRef} from "react";
import {Link, Navigate, useLocation, useParams} from "react-router";
import {t} from "@lingui/macro";
import classNames from "classnames";
import {useAutosaveStatus, usePageDetail} from "../../../layouts/AppLayout/PageStatus.tsx";
import {OrganizationTab} from "./tabs/OrganizationTab.tsx";
import {PaymentsTab} from "./tabs/PaymentsTab.tsx";
import {TaxesTab} from "./tabs/TaxesTab.tsx";
import {TeamTab} from "./tabs/TeamTab.tsx";
import {SETTINGS_TABS, SettingsTab, settingsTabLabel, settingsTabPath} from "./settingsTabs.ts";
import classes from "./Settings.module.scss";

/**
 * Figma « Admin · Paramètres »: the organizer's and the account's settings on one page, in sticky
 * tabs (also listed in the account menu, under the profile button). Every field saves itself when it is left (« Changements enregistrés » in the top bar).
 */
const Settings = () => {
    const {organizerId, tab} = useParams();
    const location = useLocation();
    const tabsRef = useRef<HTMLDivElement>(null);
    // Stripe brings the organizer back to /settings?stripe_return=1 at the end of its setup.
    const backFromStripe = /[?&]stripe_(return|refresh)=1/.test(location.search);
    const isKnownTab = SETTINGS_TABS.includes(tab as SettingsTab);
    const active: SettingsTab = isKnownTab ? tab as SettingsTab : (backFromStripe ? 'payments' : 'organization');

    usePageDetail(settingsTabLabel(active));
    // The whole page saves by itself: « Changements enregistrés » on every tab.
    useAutosaveStatus();

    // On phones the tabs scroll sideways: keep the current one in view.
    useEffect(() => {
        const list = tabsRef.current;
        const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
        if (!list || !current || list.scrollWidth <= list.clientWidth) {
            return;
        }
        const offset = current.getBoundingClientRect().left - list.getBoundingClientRect().left;
        list.scrollTo({left: list.scrollLeft + offset - (list.clientWidth - current.offsetWidth) / 2});
    }, [active]);

    if (!organizerId) {
        return null;
    }

    // « Courriels » became its own page, under « Gérer ».
    if (tab === 'emails') {
        return <Navigate to={`/manage/organizer/${organizerId}/emails`} replace/>;
    }

    if (tab && !isKnownTab) {
        return <Navigate to={settingsTabPath(organizerId, 'organization')} replace/>;
    }

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <h1 className={classes.title}>{t`Settings`}</h1>
                <p className={classes.subtitle}>{t`Your organization's details, your payments, your taxes and your team.`}</p>
            </header>

            <div className={classes.tabsSticky}>
                <nav className={classes.tabsBar} ref={tabsRef} aria-label={t`Settings`}>
                    {SETTINGS_TABS.map(id => (
                        <Link
                            key={id}
                            to={settingsTabPath(organizerId, id)}
                            className={classNames(classes.tab, {[classes.tabActive]: id === active})}
                            aria-current={id === active ? 'page' : undefined}
                        >
                            {settingsTabLabel(id)}
                        </Link>
                    ))}
                </nav>
            </div>

            {active === 'organization' && <OrganizationTab key={organizerId} organizerId={organizerId}/>}
            {active === 'payments' && <PaymentsTab key={organizerId} organizerId={organizerId}/>}
            {active === 'taxes' && <TaxesTab key={organizerId} organizerId={organizerId}/>}
            {active === 'team' && <TeamTab/>}
        </div>
    );
};

export default Settings;
