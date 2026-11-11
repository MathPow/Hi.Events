import {t} from "@lingui/macro";
import {UnstyledButton} from "@mantine/core";
import {useMediaQuery} from "@mantine/hooks";
import {useState} from "react";
import {Helmet} from "react-helmet-async";

import {ALL_UPCOMING_EVENTS, useGetUpcomingEventsPublic} from "../../../queries/useGetUpcomingEventsPublic.ts";
import {EVENT_TYPES, eventTypeLabel, eventTypeOf} from "../../../constants/eventTypes.ts";
import {DateRange, DatesMenu, isDuring, rangeBounds, SearchInput, TypesMenu} from "../../common/EventFilters";

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
                    <img src={'/landing/stickers/autocollant-calendrier.svg'} alt="" aria-hidden
                         className={classes.stickerCamera}/>
                    <p className={classes.kicker}>{t`Find your next outing`}</p>
                    <h1 className={classes.title}>
                        <span className={classes.titleText}>
                            {t`Events`}
                            <img src={'/landing/stickers/autocollant-logo.svg'} alt="" aria-hidden
                                 className={classes.stickerFlag}/>
                        </span>
                    </h1>
                    <p className={classes.line}>
                        {t`Races, outings, workshops and parties organized by the community, all across Québec.`}
                    </p>
                </header>

                <div className={classes.filters}>
                    <div className={classes.search}>
                        <SearchInput value={query} onChange={setQuery} compact={isMobile}
                                     placeholder={isMobile ? t`Search` : t`Search for an event, a place or an organizer`}
                                     label={t`Search events`}/>
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
