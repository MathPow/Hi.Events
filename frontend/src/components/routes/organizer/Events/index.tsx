import {useEffect, useState} from "react";
import {NavLink, useNavigate, useParams} from "react-router";
import {Button, Menu, Skeleton, UnstyledButton} from "@mantine/core";
import {useDisclosure, useMediaQuery} from "@mantine/hooks";
import {IconArchive, IconArchiveOff, IconCopy, IconExternalLink, IconLayoutGrid, IconList, IconPencil, IconPlus} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {useLingui} from "@lingui/react";
import classNames from "classnames";
import {Event, EventStatus, IdParam, QueryFilters} from "../../../../types.ts";
import {useGetEvents} from "../../../../queries/useGetEvents.ts";
import {useUpdateEventStatus} from "../../../../mutations/useUpdateEventStatus.ts";
import {getEventQueryFiltersWithParams} from "../../../../utilites/eventsPageFiltersHelper.ts";
import {getEventSaleStatus, getTicketCapacity, saleStatusLabel} from "../../../../utilites/eventSales.ts";
import {eventHomepagePath} from "../../../../utilites/urlHelper.ts";
import {confirmationDialog} from "../../../../utilites/confirmationDialog.tsx";
import {showSuccess} from "../../../../utilites/notifications.tsx";
import {eventTypeOf} from "../../../../constants/eventTypes.ts";
import {AccountEventType} from "../../../../types.ts";
import {DateRange, DatesMenu, isDuring, rangeBounds, SearchInput, TypesMenu} from "../../../common/EventFilters";
import {PublicIcon} from "../../../common/PublicIcon";
import {Pagination} from "../../../common/Pagination";
import {CreateEventModal} from "../../../modals/CreateEventModal";
import {DuplicateEventModal} from "../../../modals/DuplicateEventModal";
import {showStatusChangeError} from "../../../common/EmailNotConfirmedError";
import classes from "./Events.module.scss";

type EventsState = 'upcoming' | 'ended' | 'archived';
type View = 'grid' | 'list';

const STATES: EventsState[] = ['upcoming', 'ended', 'archived'];
const PER_PAGE = 60;
const VIEW_STORAGE_KEY = 'dehors-events-view';

const stateLabel = (state: EventsState) => ({
    upcoming: t`Upcoming`,
    ended: t({message: 'Ended', context: 'events tab'}),
    archived: t({message: 'Archived', context: 'events tab'}),
})[state];

// Sans accents ni majuscules: « evenement » trouve « Événement ».
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const searchableText = (event: Event) => {
    const location = event.settings?.location_details;
    return normalize([event.title, location?.venue_name, location?.city, location?.address_line_1]
        .filter(Boolean).join(' '));
};

const intlLocale = (locale: string) => locale.startsWith('fr') ? 'fr-CA' : locale;

// « sam. 7 nov. · 9 h », in the event's time zone.
const useEventDate = () => {
    const {i18n} = useLingui();
    const locale = intlLocale(i18n.locale);

    return (event: Event) => {
        if (!event.start_date) {
            return null;
        }
        const date = new Date(event.start_date);
        const timeZone = event.timezone || undefined;
        const day = new Intl.DateTimeFormat(locale, {weekday: 'short', day: 'numeric', month: 'short', timeZone})
            .format(date);
        const minutes = Number(new Intl.DateTimeFormat('en', {minute: 'numeric', timeZone}).format(date));
        const time = new Intl.DateTimeFormat(locale, {
            hour: 'numeric',
            ...(minutes ? {minute: '2-digit'} : {}),
            timeZone,
        }).format(date);

        return `${day} · ${time}`;
    };
};

const locationOf = (event: Event) => event.settings?.is_online_event
    ? t`Online Event`
    : (event.settings?.location_details?.venue_name || event.settings?.location_details?.city || null);

interface EventActionsProps {
    event: Event;
    onDuplicate: (eventId: IdParam) => void;
}

// The « ··· » menu of a card: edit, duplicate, view the page, archive (or restore).
const EventActions = ({event, onDuplicate}: EventActionsProps) => {
    const navigate = useNavigate();
    const statusMutation = useUpdateEventStatus();
    const archived = event.status === EventStatus.ARCHIVED;

    const toggleArchive = () => confirmationDialog(
        archived
            ? t`Are you sure you want to restore this event? It will be restored as a draft event.`
            : t`Are you sure you want to archive this event?`,
        () => statusMutation.mutate({eventId: event.id, status: archived ? 'DRAFT' : 'ARCHIVED'}, {
            onSuccess: () => showSuccess(t`Event status updated`),
            onError: (error: any) => showStatusChangeError(error, t`Event status update failed. Please try again later`),
        }),
    );

    return (
        <Menu position="bottom-end" width={230} withinPortal>
            <Menu.Target>
                <UnstyledButton className={classes.moreButton} aria-label={t`Event actions`}>
                    <img src="/interface/admin/evenements/plus-options.svg" alt=""/>
                </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
                <Menu.Item leftSection={<IconPencil size={16}/>}
                           onClick={() => navigate(`/manage/event/${event.id}/settings`)}>
                    {t`Edit`}
                </Menu.Item>
                <Menu.Item leftSection={<IconCopy size={16}/>} onClick={() => onDuplicate(event.id as IdParam)}>
                    {t`Duplicate`}
                </Menu.Item>
                <Menu.Item leftSection={<IconExternalLink size={16}/>} component="a"
                           href={eventHomepagePath(event)} target="_blank" rel="noopener">
                    {t`View the page`}
                </Menu.Item>
                <Menu.Item leftSection={archived ? <IconArchiveOff size={16}/> : <IconArchive size={16}/>}
                           onClick={toggleArchive}>
                    {archived ? t`Restore` : t`Archive`}
                </Menu.Item>
            </Menu.Dropdown>
        </Menu>
    );
};

const Tickets = ({event}: { event: Event }) => {
    const capacity = getTicketCapacity(event);
    const status = getEventSaleStatus(event, capacity);
    const progress = capacity.capacity ? Math.min(100, (capacity.sold / capacity.capacity) * 100) : 0;

    return (
        <div className={classes.tickets}>
            <div className={classes.ticketsLine}>
                <span>
                    {capacity.capacity
                        ? t`${capacity.sold} / ${capacity.capacity} tickets`
                        : t`${capacity.sold} tickets`}
                </span>
                <span className={classes.tag} data-status={status}>{saleStatusLabel(status)}</span>
            </div>
            {capacity.capacity && (
                <span className={classes.progress}><span style={{width: `${progress}%`}}/></span>
            )}
        </div>
    );
};

const Cover = ({event, className, children}: { event: Event, className: string, children?: React.ReactNode }) => {
    const cover = event.images?.find((image) => image.type === 'EVENT_COVER');

    return (
        <div className={className} style={cover ? {backgroundImage: `url(${cover.url})`} : undefined}
             data-empty={!cover || undefined}>
            {children}
        </div>
    );
};

const EventCardItem = ({event, onDuplicate}: EventActionsProps) => {
    const formatDate = useEventDate();
    const date = formatDate(event);
    const location = locationOf(event);

    return (
        <article className={classes.card}>
            <Cover event={event} className={classes.cardImage}>
                <div className={classes.cardImageBar}>
                    {date ? (
                        <span className={classes.datePill}>
                            <PublicIcon name="calendrier" size={14}/>
                            {date}
                        </span>
                    ) : <span/>}
                    <EventActions event={event} onDuplicate={onDuplicate}/>
                </div>
            </Cover>
            <div className={classes.cardBody}>
                <NavLink to={`/manage/event/${event.id}/dashboard`} className={classes.cardLink}>
                    {event.title}
                </NavLink>
                {location && (
                    <span className={classes.location}>
                        <PublicIcon name="lieu-petit" size={15}/>
                        <span>{location}</span>
                    </span>
                )}
                <Tickets event={event}/>
            </div>
        </article>
    );
};

const EventListRow = ({event, onDuplicate}: EventActionsProps) => {
    const formatDate = useEventDate();
    const date = formatDate(event);
    const location = locationOf(event);

    return (
        <article className={classes.row}>
            <Cover event={event} className={classes.rowImage}/>
            <div className={classes.rowInfo}>
                {date && <span className={classes.rowDate}>{date}</span>}
                <NavLink to={`/manage/event/${event.id}/dashboard`} className={classes.cardLink}>
                    {event.title}
                </NavLink>
                {location && <span className={classes.rowLocation}>{location}</span>}
            </div>
            <div className={classes.rowTickets}>
                <Tickets event={event}/>
            </div>
            <EventActions event={event} onDuplicate={onDuplicate}/>
        </article>
    );
};

/**
 * Figma « Admin · Événements »: the organizer's events in cards (or a list), by tab (upcoming,
 * ended, archived), to search and filter by date and type like the public events directory.
 */
const Events = () => {
    const {organizerId, eventsState} = useParams();
    const state: EventsState = STATES.includes(eventsState as EventsState) ? eventsState as EventsState : 'upcoming';
    const navigate = useNavigate();
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const isMobile = useMediaQuery('(max-width: 767px)');
    const [createModalOpen, {open: openCreateModal, close: closeCreateModal}] = useDisclosure(false);
    const [duplicateId, setDuplicateId] = useState<IdParam>();
    const [page, setPage] = useState(1);
    const [query, setQuery] = useState('');
    const [dates, setDates] = useState<DateRange>('ALL');
    const [types, setTypes] = useState<AccountEventType[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [view, setView] = useState<View>('grid');

    useEffect(() => {
        try {
            setView(localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid');
        } catch {
            // localStorage unavailable
        }
    }, []);

    useEffect(() => setPage(1), [state]);

    const chooseView = (next: View) => {
        setView(next);
        try {
            localStorage.setItem(VIEW_STORAGE_KEY, next);
        } catch {
            // localStorage unavailable
        }
    };

    const filtersFor = (eventsStateFilter: EventsState, perPage: number, pageNumber = 1) =>
        getEventQueryFiltersWithParams({perPage, pageNumber}, eventsStateFilter, organizerId) as QueryFilters;

    const eventsQuery = useGetEvents(filtersFor(state, PER_PAGE, page));
    const upcomingCount = useGetEvents(filtersFor('upcoming', 1)).data?.meta?.total;
    const endedCount = useGetEvents(filtersFor('ended', 1)).data?.meta?.total;
    const archivedCount = useGetEvents(filtersFor('archived', 1)).data?.meta?.total;
    const counts: Record<EventsState, number | undefined> = {
        upcoming: upcomingCount,
        ended: endedCount,
        archived: archivedCount,
    };

    const events = eventsQuery.data?.data ?? [];
    const lastPage = Number(eventsQuery.data?.meta?.last_page ?? 1);

    const bounds = dates === 'ALL' ? null : rangeBounds(dates);
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const filtered = words.length > 0 || dates !== 'ALL' || types.length > 0;
    const results = events
        .filter((event) => (!bounds || isDuring(event, bounds))
            && words.every((word) => searchableText(event).includes(word))
            && (types.length === 0 || types.includes(eventTypeOf(event))))
        .sort((a, b) => state === 'upcoming'
            ? (a.start_date ?? '').localeCompare(b.start_date ?? '')
            : (b.start_date ?? '').localeCompare(a.start_date ?? ''));

    const clearFilters = () => {
        setQuery('');
        setDates('ALL');
        setTypes([]);
    };

    const showCreateCard = state === 'upcoming' && !filtered && view === 'grid';

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <h1 className={classes.title}>{t`Events`}</h1>
                <p className={classes.subtitle}>{t`All your events, upcoming, ended and archived.`}</p>
            </header>

            <Button className={classes.mobileCreateButton} leftSection={<IconPlus size={20} stroke={2.25}/>}
                    onClick={openCreateModal}>
                {t`Create Event`}
            </Button>

            <div className={classes.filters}>
                <div className={classes.search}>
                    <SearchInput value={query} onChange={setQuery} compact={isMobile}
                                 placeholder={isMobile ? t`Search` : t`Search for an event or a place`}
                                 label={t`Search events`}/>
                    <UnstyledButton
                        className={classNames(classes.filterToggle, {[classes.filterToggleActive]: showFilters || dates !== 'ALL' || types.length > 0})}
                        onClick={() => setShowFilters((current) => !current)}
                        aria-expanded={showFilters}
                        aria-label={t`Filters`}
                    >
                        <PublicIcon name="filtres" size={18}/>
                    </UnstyledButton>
                </div>
                <div className={classNames(classes.menus, {[classes.menusOpen]: showFilters})}>
                    <DatesMenu value={dates} onChange={setDates}/>
                    <TypesMenu value={types} onChange={setTypes}/>
                </div>
            </div>

            <div className={classes.toolbar}>
                <nav className={classes.tabs} aria-label={t`Events`}>
                    {STATES.map((item) => (
                        <UnstyledButton
                            key={item}
                            className={classNames(classes.tab, {[classes.tabActive]: item === state})}
                            aria-current={item === state ? 'page' : undefined}
                            onClick={() => navigate(`/manage/organizer/${organizerId}/events/${item}`)}
                        >
                            {stateLabel(item)}
                            {!!counts[item] && <span className={classes.tabCount}>{counts[item]}</span>}
                        </UnstyledButton>
                    ))}
                </nav>
                <div className={classes.viewToggle} role="radiogroup" aria-label={t`Display`}>
                    <UnstyledButton role="radio" aria-checked={view === 'grid'} aria-label={t`Grid`}
                                    className={classNames(classes.viewButton, {[classes.viewButtonActive]: view === 'grid'})}
                                    onClick={() => chooseView('grid')}>
                        <IconLayoutGrid size={18} stroke={2}/>
                    </UnstyledButton>
                    <UnstyledButton role="radio" aria-checked={view === 'list'} aria-label={t`List`}
                                    className={classNames(classes.viewButton, {[classes.viewButtonActive]: view === 'list'})}
                                    onClick={() => chooseView('list')}>
                        <IconList size={18} stroke={2}/>
                    </UnstyledButton>
                </div>
            </div>

            {eventsQuery.isLoading && (
                <div className={classes.grid}>
                    {Array.from({length: 3}).map((_, index) => <Skeleton key={index} height={360} radius={28}/>)}
                </div>
            )}

            {!eventsQuery.isLoading && results.length === 0 && !showCreateCard && (
                <div className={classes.empty}>
                    <PublicIcon name="calendrier" size={28}/>
                    <p>
                        {filtered
                            ? t`No events match your search.`
                            : ({
                                upcoming: t`No upcoming events. Create your first one to start selling tickets.`,
                                ended: t`No ended events yet.`,
                                archived: t`No archived events.`,
                            })[state]}
                    </p>
                    {filtered && (
                        <Button variant="outline" onClick={clearFilters}>{t`Clear filters`}</Button>
                    )}
                    {!filtered && state === 'upcoming' && (
                        <Button onClick={openCreateModal} className={classes.emptyCreate}>{t`Create Event`}</Button>
                    )}
                </div>
            )}

            {!eventsQuery.isLoading && (results.length > 0 || showCreateCard) && (
                view === 'list' ? (
                    <div className={classes.list}>
                        {results.map((event) => (
                            <EventListRow key={event.id} event={event} onDuplicate={setDuplicateId}/>
                        ))}
                    </div>
                ) : (
                    <div className={classes.grid}>
                        {results.map((event) => (
                            <EventCardItem key={event.id} event={event} onDuplicate={setDuplicateId}/>
                        ))}
                        {showCreateCard && (
                            <UnstyledButton className={classes.createCard} onClick={openCreateModal}>
                                <span className={classes.createPastille}><PublicIcon name="plus" size={28}/></span>
                                <span className={classes.createTitle}>{t`Create Event`}</span>
                                <span className={classes.createText}>
                                    {t`Start with a draft, you'll publish when you're ready.`}
                                </span>
                            </UnstyledButton>
                        )}
                    </div>
                )
            )}

            {lastPage > 1 && (
                <Pagination value={page} onChange={setPage} total={lastPage}/>
            )}

            {createModalOpen && <CreateEventModal organizerId={organizerId} onClose={closeCreateModal}/>}
            {duplicateId && <DuplicateEventModal eventId={duplicateId} onClose={() => setDuplicateId(undefined)}/>}
        </div>
    );
};

export default Events;
