import {useEffect, useRef} from "react";
import {Link, Navigate, useLocation, useParams} from "react-router";
import {t} from "@lingui/macro";
import classNames from "classnames";
import {Skeleton} from "@mantine/core";
import {useAutosaveStatus, usePageDetail} from "../../../layouts/AppLayout/PageStatus.tsx";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetEventSettings} from "../../../../queries/useGetEventSettings.ts";
import {EventTab} from "./tabs/EventTab.tsx";
import {RegistrationTab} from "./tabs/RegistrationTab.tsx";
import {PaymentTab} from "./tabs/PaymentTab.tsx";
import {EVENT_SETTINGS_TABS, EventSettingsTab, eventSettingsTabPath, SECTION_TABS} from "./settingsTabs.ts";
import classes from "../../organizer/Settings/Settings.module.scss";

const tabLabel = (tab: EventSettingsTab) => ({
    event: t({message: 'Event', context: 'settings tab'}),
    registration: t({message: 'Registration', context: 'settings tab'}),
    payment: t`Payment & Invoicing`,
})[tab];

const SettingsSkeleton = () => (
    <div className={classes.grid}>
        <Skeleton className={classes.full} height={420} radius={32}/>
        <Skeleton height={360} radius={32}/>
        <Skeleton height={360} radius={32}/>
    </div>
);

/**
 * « Paramètres de l'événement », like the organizer's Paramètres: sticky tabs, sections in a bento
 * layout, and every field saves itself when it is left (« Changements enregistrés » in the top bar).
 */
const Settings = () => {
    const {eventId, tab} = useParams();
    const location = useLocation();
    const tabsRef = useRef<HTMLDivElement>(null);
    const {data: event} = useGetEvent(eventId);
    const {data: settings} = useGetEventSettings(eventId);

    // The former single page's anchors (…/settings#waitlist-settings) open the tab that holds the section.
    const anchor = location.hash.replace('#', '');
    const anchorTab = SECTION_TABS[anchor];
    const isKnownTab = EVENT_SETTINGS_TABS.includes(tab as EventSettingsTab);
    const active: EventSettingsTab = isKnownTab ? tab as EventSettingsTab : (anchorTab ?? 'event');

    usePageDetail(tabLabel(active));
    useAutosaveStatus();

    const ready = !!event && !!settings;

    useEffect(() => {
        if (!ready || !anchor) {
            return;
        }
        const timer = window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({behavior: 'smooth', block: 'start'}), 150);
        return () => window.clearTimeout(timer);
    }, [ready, anchor, active]);

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

    if (!eventId) {
        return null;
    }

    if ((tab && !isKnownTab) || (!tab && anchorTab)) {
        return <Navigate to={eventSettingsTabPath(eventId, active) + (anchorTab ? location.hash : '')} replace/>;
    }

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <h1 className={classes.title}>{t`Settings`}</h1>
                <p className={classes.subtitle}>{t`The settings of this event.`}</p>
            </header>

            <div className={classes.tabsSticky}>
                <nav className={classes.tabsBar} ref={tabsRef} aria-label={t`Event Settings`}>
                    {EVENT_SETTINGS_TABS.map(id => (
                        <Link
                            key={id}
                            to={eventSettingsTabPath(eventId, id)}
                            className={classNames(classes.tab, {[classes.tabActive]: id === active})}
                            aria-current={id === active ? 'page' : undefined}
                        >
                            {tabLabel(id)}
                        </Link>
                    ))}
                </nav>
            </div>

            {!ready && <SettingsSkeleton/>}
            {ready && active === 'event' && <EventTab key={eventId} eventId={eventId} event={event} settings={settings}/>}
            {ready && active === 'registration' && <RegistrationTab key={eventId} eventId={eventId} settings={settings}/>}
            {ready && active === 'payment' && <PaymentTab key={eventId} eventId={eventId} event={event} settings={settings}/>}
        </div>
    );
};

export default Settings;
