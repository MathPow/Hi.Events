import {t} from "@lingui/macro";
import {Popover, TextInput, UnstyledButton} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {ComponentPropsWithoutRef, forwardRef, ReactNode, useState} from "react";
import {Helmet} from "react-helmet-async";
import dayjs, {Dayjs} from "dayjs";

import {ALL_UPCOMING_EVENTS, useGetUpcomingEventsPublic} from "../../../queries/useGetUpcomingEventsPublic.ts";
import {EVENT_TYPES, eventTypeLabel, eventTypeOf} from "../../../constants/eventTypes.ts";

import {PublicBarLink, PublicPageBar} from "../../common/PublicPageBar";
import {PublicPageFooter} from "../../common/PublicPageFooter";
import {PublicIcon} from "../../common/PublicIcon";
import {EventTypeIllustration} from "../../common/EventTypeIllustration";
import {CarouselList, CarouselNav} from "../../common/Carousel";
import {useCarousel} from "../../../hooks/useCarousel.ts";
import {EventCard} from "../../layouts/OrganizerHomepage/EventCard";

import {AccountEventType, Event} from "../../../types.ts";
import shell from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import classes from './EventsDirectory.module.scss';

type DateRange = 'ALL' | 'TODAY' | 'WEEKEND' | 'NEXT_7_DAYS' | 'THIS_MONTH';

const DATE_RANGES: DateRange[] = ['ALL', 'TODAY', 'WEEKEND', 'NEXT_7_DAYS', 'THIS_MONTH'];

const dateRangeLabel = (range: DateRange) => ({
    ALL: t`All dates`,
    TODAY: t`Today`,
    WEEKEND: t`This weekend`,
    NEXT_7_DAYS: t`Next 7 days`,
    THIS_MONTH: t`This month`,
})[range];

// Les bornes d'une periode, a l'heure de l'appareil. La fin de semaine: le samedi et le
// dimanche qui viennent (le dimanche, la veille et ce jour-la).
const rangeBounds = (range: Exclude<DateRange, 'ALL'>): [Dayjs, Dayjs] => {
    const now = dayjs();

    switch (range) {
        case 'TODAY':
            return [now.startOf('day'), now.endOf('day')];
        case 'WEEKEND': {
            const saturday = now.day() === 0 ? now.subtract(1, 'day') : now.add(6 - now.day(), 'day');
            return [saturday.startOf('day'), saturday.add(1, 'day').endOf('day')];
        }
        case 'NEXT_7_DAYS':
            return [now.startOf('day'), now.add(6, 'day').endOf('day')];
        case 'THIS_MONTH':
            return [now.startOf('month'), now.endOf('month')];
    }
};

// Pendant la periode: commence avant sa fin, finit apres son debut (8 h sans fin, comme les cartes).
const isDuring = (event: Event, [from, to]: [Dayjs, Dayjs]) => {
    const start = dayjs.utc(event.start_date);
    const end = event.end_date ? dayjs.utc(event.end_date) : start.add(8, 'hour');

    return !start.isAfter(to) && !end.isBefore(from);
};

// Sans accents ni majuscules: « evenement » trouve « Événement ».
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const searchableText = (event: Event) => {
    const location = event.settings?.location_details;

    return normalize([
        event.title,
        event.organizer?.name,
        location?.venue_name,
        location?.city,
        location?.address_line_1,
        location?.state_or_region,
    ].filter(Boolean).join(' '));
};

const upcomingCount = (count: number) => count === 1 ? t`1 upcoming event` : t`${count} upcoming events`;

// Une case du menu deroulant: la vraie case (cochee ou radio) reste au clavier, cachee sous la rangee.
const MenuOption = ({type, name, checked, onChange, illustration, label}: {
    type: 'checkbox' | 'radio',
    name: string,
    checked: boolean,
    onChange: () => void,
    illustration?: ReactNode,
    label: string,
}) => (
    <label className={classes.option} data-checked={checked || undefined}>
        <input type={type} name={name} checked={checked} onChange={onChange} className={classes.optionInput}/>
        {illustration !== undefined && <span className={classes.optionIllustration}>{illustration}</span>}
        <span className={classes.optionLabel}>{label}</span>
        <span className={classes.box} aria-hidden>
            {checked && <PublicIcon name={'coche'} size={14}/>}
        </span>
    </label>
);

// Le bouton d'un menu deroulant (dates, types), sous son ombre: la decoupe la couperait.
// Popover.Target lui passe sa ref et ses attributs aria.
const MenuTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'> & {
    opened: boolean,
    active: boolean,
}>(({opened, active, children, ...others}, ref) => (
    <div className={classes.shadow}>
        <UnstyledButton ref={ref} {...others} className={classes.trigger} data-rough="button"
                        data-active={opened || active || undefined}>
            <span className={classes.triggerLabel}>{children}</span>
            <PublicIcon name={'chevron'} size={18} className={classes.chevron}/>
        </UnstyledButton>
    </div>
));

const DatesMenu = ({value, onChange}: { value: DateRange, onChange: (value: DateRange) => void }) => {
    const [opened, setOpened] = useState(false);

    return (
        <Popover opened={opened} onChange={setOpened} position="bottom-end" offset={10} width={300}
                 trapFocus classNames={{dropdown: classes.menu}}>
            <Popover.Target>
                <MenuTrigger opened={opened} active={value !== 'ALL'} onClick={() => setOpened((current) => !current)}>
                    {value === 'ALL' ? (
                        <>
                            <span className={shell.longLabel}>{t`All dates`}</span>
                            <span className={shell.shortLabel}>{t`Dates`}</span>
                        </>
                    ) : dateRangeLabel(value)}
                </MenuTrigger>
            </Popover.Target>
            <Popover.Dropdown>
                <div role="radiogroup" aria-label={t`Dates`} className={classes.options}>
                    {DATE_RANGES.map((range) => (
                        <MenuOption key={range} type={'radio'} name={'dates'} checked={value === range}
                                    label={dateRangeLabel(range)}
                                    onChange={() => {
                                        onChange(range);
                                        setOpened(false);
                                    }}/>
                    ))}
                </div>
            </Popover.Dropdown>
        </Popover>
    );
};

// Plusieurs types a la fois: chaque case filtre tout de suite, le menu reste ouvert pour en cocher
// d'autres. Aucun type, ou tous, c'est « Tous ».
const TypesMenu = ({value, onChange}: {
    value: AccountEventType[],
    onChange: (value: AccountEventType[]) => void,
}) => {
    const [opened, setOpened] = useState(false);

    const toggle = (type: AccountEventType) => {
        const next = value.includes(type) ? value.filter((item) => item !== type) : [...value, type];
        onChange(next.length === EVENT_TYPES.length ? [] : EVENT_TYPES.filter((item) => next.includes(item)));
    };

    const count = value.length;

    return (
        <Popover opened={opened} onChange={setOpened} position="bottom-end" offset={10} width={300}
                 trapFocus classNames={{dropdown: classes.menu}}>
            <Popover.Target>
                <MenuTrigger opened={opened} active={value.length > 0} onClick={() => setOpened((current) => !current)}>
                    <PublicIcon name={'filtres'} size={18} className={classes.accentIcon}/>
                    {value.length === 0 && (
                        <>
                            <span className={shell.longLabel}>{t`All types`}</span>
                            <span className={shell.shortLabel}>{t`Types`}</span>
                        </>
                    )}
                    {value.length === 1 && eventTypeLabel(value[0])}
                    {count > 1 && t`${count} types`}
                </MenuTrigger>
            </Popover.Target>
            <Popover.Dropdown>
                <div role="group" aria-label={t`Types`} className={classes.options}>
                    <MenuOption type={'checkbox'} name={'types'} checked={value.length === 0} illustration={null}
                                label={t({message: 'All', context: 'event types'})} onChange={() => onChange([])}/>
                    {EVENT_TYPES.map((type) => (
                        <MenuOption key={type} type={'checkbox'} name={'types'} checked={value.includes(type)}
                                    illustration={<EventTypeIllustration type={type}/>}
                                    label={eventTypeLabel(type)} onChange={() => toggle(type)}/>
                    ))}
                </div>
            </Popover.Dropdown>
        </Popover>
    );
};

// Une section par type: l'illustration, le nombre d'evenements, puis les cartes en carrousel.
// Sur grand ecran, les fleches le font defiler d'une page; sur telephone, on glisse.
const TypeSection = ({type, events}: { type: AccountEventType, events: Event[] }) => {
    const carousel = useCarousel(events.length);
    const titleId = `type-${type.toLowerCase()}`;

    return (
        <section className={`${shell.card} ${classes.section}`} data-rough aria-labelledby={titleId}>
            <div className={classes.sectionHeader}>
                <div className={classes.sectionHeading}>
                    <span className={classes.sectionIllustration}><EventTypeIllustration type={type}/></span>
                    <div className={classes.sectionText}>
                        <h2 id={titleId} className={classes.sectionTitle}>{eventTypeLabel(type)}</h2>
                        <p className={classes.sectionCount}>{upcomingCount(events.length)}</p>
                    </div>
                </div>
                <CarouselNav carousel={carousel}/>
            </div>
            <CarouselList carousel={carousel}>
                {events.map((event) => (
                    <li key={event.id}><EventCard event={event} compact/></li>
                ))}
            </CarouselList>
        </section>
    );
};

// Avec une recherche ou un filtre: tous les resultats dans une seule grille, par date, au lieu
// des carrousels par type (trois colonnes sur grand ecran, deux en dessous).
const ResultsSection = ({events, onClear}: { events: Event[], onClear: () => void }) => (
    <section className={`${shell.card} ${classes.section} ${classes.results}`} data-rough
             aria-labelledby={'resultats'}>
        <div className={classes.sectionHeader}>
            <div className={classes.sectionText}>
                <h2 id={'resultats'} className={classes.sectionTitle}>{t`Results`}</h2>
                <p className={classes.sectionCount}>{upcomingCount(events.length)}</p>
            </div>
            <UnstyledButton className={`${shell.button} ${shell.buttonOutline} ${classes.clearResults}`} data-rough="button"
                            onClick={onClear}>
                {t`Clear filters`}
            </UnstyledButton>
        </div>
        <ul className={classes.grid}>
            {events.map((event) => (
                <li key={event.id}><EventCard event={event} compact/></li>
            ))}
        </ul>
    </section>
);

/**
 * Le repertoire des evenements de la billetterie (maquette Figma « Public · Repertoire
 * d'evenements »): tous les evenements a venir des organisateurs publies, une section par type
 * (Sport, Entrepreneuriat, Social, Autre), a chercher par nom, lieu ou organisateur, et a filtrer
 * par dates et par types. Les filtres agissent sur la page, sans retourner a l'API; filtres ou
 * recherche actifs, les resultats passent en grille.
 */
export const EventsDirectory = () => {
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const isMobile = useMediaQuery('(max-width: 767px)');
    const {data: events = [], isLoading} = useGetUpcomingEventsPublic(ALL_UPCOMING_EVENTS);
    const [query, setQuery] = useState('');
    const [dates, setDates] = useState<DateRange>('ALL');
    const [types, setTypes] = useState<AccountEventType[]>([]);

    const bounds = dates === 'ALL' ? null : rangeBounds(dates);
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const results = events.filter((event) => (!bounds || isDuring(event, bounds))
        && words.every((word) => searchableText(event).includes(word))
        && (types.length === 0 || types.includes(eventTypeOf(event))));
    const sections = EVENT_TYPES
        .map((type) => ({type, events: results.filter((event) => eventTypeOf(event) === type)}))
        .filter((section) => section.events.length > 0);
    const filtered = words.length > 0 || dates !== 'ALL' || types.length > 0;

    const clearFilters = () => {
        setQuery('');
        setDates('ALL');
        setTypes([]);
    };

    return (
        <main className={`${shell.page} ${classes.page}`}>
            <Helmet>
                <title>{t`Events · Billetterie Dehors`}</title>
            </Helmet>
            <style>
                {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                {`
                    body, .ssr-loader {
                        background-color: var(--dehors-creme) !important;
                    }
                `}
            </style>

            <div className={`${shell.content} ${classes.content}`}>
                <div className={shell.bar}>
                    {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                    <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}/>
                </div>

                <header className={classes.hero}>
                    <img src={'/landing/stickers/autocollant-appareil-photo.webp'} alt="" aria-hidden
                         className={classes.stickerCamera}/>
                    <p className={classes.kicker}>{t`Find your next outing`}</p>
                    <h1 className={classes.title}>
                        <span className={classes.titleText}>
                            {t`Events`}
                            <img src={'/landing/stickers/autocollant-drapeau-dehors.webp'} alt="" aria-hidden
                                 className={classes.stickerFlag}/>
                        </span>
                    </h1>
                    <p className={classes.line}>
                        {t`Races, outings, workshops and parties organized by the community, all across Québec.`}
                    </p>
                </header>

                <div className={classes.filters}>
                    <div className={`${classes.shadow} ${classes.search}`}>
                        <TextInput type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)}
                                   placeholder={isMobile ? t`Search` : t`Search for an event, a place or an organizer`}
                                   aria-label={t`Search events`}
                                   leftSection={<PublicIcon name={'recherche'} size={isMobile ? 18 : 20}/>}
                                   leftSectionPointerEvents="none"
                                   classNames={{root: classes.searchRoot, input: classes.searchInput, section: classes.searchIcon}}/>
                    </div>
                    <DatesMenu value={dates} onChange={setDates}/>
                    <TypesMenu value={types} onChange={setTypes}/>
                </div>

                {filtered && results.length > 0 && <ResultsSection events={results} onClear={clearFilters}/>}

                {!filtered && sections.map((section) => (
                    <TypeSection key={section.type} type={section.type} events={section.events}/>
                ))}

                {!isLoading && results.length === 0 && (
                    <section className={`${shell.card} ${classes.noResults}`} data-rough>
                        <div className={shell.empty}>
                            <PublicIcon name={'calendrier'} size={28} className={classes.accentIcon}/>
                            <p>{filtered ? t`No events match your search.` : t`No upcoming events`}</p>
                            {filtered && (
                                <UnstyledButton className={`${shell.button} ${shell.buttonOutline} ${classes.clear}`} data-rough="button"
                                                onClick={clearFilters}>
                                    {t`Clear filters`}
                                </UnstyledButton>
                            )}
                        </div>
                    </section>
                )}

                <PublicPageFooter/>
            </div>
        </main>
    );
};

export default EventsDirectory;
