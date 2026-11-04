import {useEffect, useRef} from "react";
import {Link, Navigate, useLocation, useParams} from "react-router";
import {t} from "@lingui/macro";
import classNames from "classnames";
import {useAutosaveStatus, usePageDetail} from "../../../layouts/AppLayout/PageStatus.tsx";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetEventSettings} from "../../../../queries/useGetEventSettings.ts";
import {EventTab} from "./tabs/EventTab.tsx";
import {RegistrationTab} from "./tabs/RegistrationTab.tsx";
import {PaymentTab} from "./tabs/PaymentTab.tsx";
import {EVENT_SETTINGS_TABS, EventSettingsTab, eventSettingsTabPath, SECTION_TABS} from "./settingsTabs.ts";
import {PillChoice, SettingsCard} from "../../organizer/Settings/SettingsUi.tsx";
import {SkeletonLine} from "../../../common/Skeletons";
import {EVENT_TYPES, eventTypeLabel} from "../../../../constants/eventTypes.ts";
import classes from "../../organizer/Settings/Settings.module.scss";
import extra from "./EventSettings.module.scss";

const tabLabel = (tab: EventSettingsTab) => ({
    event: t({message: 'Event', context: 'settings tab'}),
    registration: t({message: 'Registration', context: 'settings tab'}),
    payment: t`Payment & Invoicing`,
})[tab];

// A field while the settings load: its real label over an empty field (or a placeholder label).
const FieldSkeleton = ({label, span, tall}: { label?: string, span?: boolean, tall?: boolean }) => (
    <div className={classNames(extra.skeletonField, {[classes.fieldsSpan]: span})}>
        {label ? <p className={classes.fieldLabel}>{label}</p> : <SkeletonLine width={110} height={14}/>}
        <div className={extra.skeletonInput} data-tall={tall || undefined}/>
    </div>
);

const CardHeadSkeleton = () => (
    <div className={classes.cardHead}>
        <div className={classes.cardHeadText}>
            <SkeletonLine width={180} height={22}/>
            <SkeletonLine width="70%" height={12}/>
        </div>
    </div>
);

// The settings while they load: on « Événement », the real « Infos de base », « Lieu » and « Référencement »
// frames with their labels; on the other tabs, cards of fields.
const SettingsSkeleton = ({tab}: { tab: EventSettingsTab }) => {
    if (tab !== 'event') {
        return (
            <div className={classes.grid} aria-busy>
                {[true, false, false].map((full, index) => (
                    <section key={index} className={classNames(classes.card, {[classes.full]: full})}>
                        <CardHeadSkeleton/>
                        <div className={classes.fields}>
                            <FieldSkeleton span={!full}/>
                            <FieldSkeleton span={!full}/>
                            <FieldSkeleton span tall={full}/>
                        </div>
                    </section>
                ))}
            </div>
        );
    }

    return (
        <div className={classes.grid} aria-busy>
            <SettingsCard full title={t`Basic info`} subtitle={t`Shown on the event page, on tickets and in emails.`}>
                <div className={classes.fields}>
                    <FieldSkeleton span label={t`Event name`}/>
                    <div className={`${classes.fieldsSpan} ${extra.fieldGroup}`}>
                        <p className={classes.fieldLabel}>{t`Category`}</p>
                        <PillChoice label={t`Category`} value={null} disabled onChange={() => undefined}
                                    options={EVENT_TYPES.map(type => ({value: type, label: eventTypeLabel(type)}))}/>
                        <p className={classes.hint}>{t`Used for the Directory filters.`}</p>
                    </div>
                    <FieldSkeleton label={t({message: 'Start', context: 'event date'})}/>
                    <FieldSkeleton label={t({message: 'End', context: 'event date'})}/>
                    <FieldSkeleton span label={t`Timezone`}/>
                    <FieldSkeleton span tall label={t`Description`}/>
                </div>
            </SettingsCard>
            <SettingsCard title={t({message: 'Location', context: 'place'})} subtitle={t`Shown on the event page and on tickets.`}>
                <div className={classes.fields}>
                    <FieldSkeleton span/>
                    <FieldSkeleton span/>
                    <FieldSkeleton/>
                    <FieldSkeleton/>
                </div>
            </SettingsCard>
            <SettingsCard title={t`Search engines (Google)`} subtitle={t`How the event page shows in Google and when it is shared.`}>
                <div className={classes.fields}>
                    <FieldSkeleton span label={t`Title`}/>
                    <FieldSkeleton span tall label={t`Description`}/>
                    <FieldSkeleton span label={t`Keywords`}/>
                </div>
            </SettingsCard>
        </div>
    );
};

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

            {!ready && <SettingsSkeleton tab={active}/>}
            {ready && active === 'event' && <EventTab key={eventId} eventId={eventId} event={event} settings={settings}/>}
            {ready && active === 'registration' && <RegistrationTab key={eventId} eventId={eventId} settings={settings}/>}
            {ready && active === 'payment' && <PaymentTab key={eventId} eventId={eventId} event={event} settings={settings}/>}
        </div>
    );
};

export default Settings;
