import {t} from "@lingui/macro";
import {Link, useNavigate, useParams, useSearchParams} from "react-router";
import {Button, TextInput, UnstyledButton} from "@mantine/core";
import {useForm} from "@mantine/form";
import {useEffect, useState} from "react";
import {Helmet} from "react-helmet-async";
import dayjs from "dayjs";

import {useGetOrdersByLookupToken} from "../../../queries/useGetOrdersByLookupToken.ts";
import {useSendTicketLookupEmail} from "../../../mutations/useSendTicketLookupEmail.ts";
import {useGetUpcomingEventsPublic} from "../../../queries/useGetUpcomingEventsPublic.ts";
import {showError} from "../../../utilites/notifications.tsx";
import {eventCoverImageUrl, eventHomepagePath, organizerHomepagePath} from "../../../utilites/urlHelper.ts";
import {getShortLocationDisplay} from "../../../utilites/addressUtilities.ts";
import {useRoughEdges} from "../../../hooks/useRoughEdges.ts";

import {PublicBarLink, PublicPageBar} from "../../common/PublicPageBar";
import {PublicPageFooter} from "../../common/PublicPageFooter";
import {PublicIcon} from "../../common/PublicIcon";
import {InstallAppButton} from "../../common/InstallAppButton";
import {EventCard} from "../../layouts/OrganizerHomepage/EventCard";
import {ConfirmationTicket} from "../product-widget/OrderSummaryAndProducts/ConfirmationTicket";
import {eventRangeLabel, shortDayLabel} from "../product-widget/OrderSummaryAndProducts/confirmationDates.ts";

import {Attendee, Event, EventLifecycleStatus, Order} from "../../../types.ts";
import shell from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import classes from './MyTickets.module.scss';

// Le dernier lien valide de l'appareil, pour que l'app installee rouvre le tableau de bord.
const SAVED_LINK_KEY = 'dehors-mes-billets-lien';

const isInstalledApp = () => window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// Les billets d'un evenement, toutes commandes confondues.
interface EventTickets {
    event: Event;
    orders: Order[];
    attendees: Attendee[];
}

const groupByEvent = (orders: Order[]): EventTickets[] => {
    const groups = new Map<string, EventTickets>();
    orders.forEach((order) => {
        const event = order.event as Event | undefined;
        if (!event) {
            return;
        }
        const group = groups.get(String(event.id)) ?? {event, orders: [], attendees: []};
        group.orders.push(order);
        group.attendees.push(...(order.attendees ?? []));
        groups.set(String(event.id), group);
    });

    return [...groups.values()];
};

// Passe: termine selon l'API, sinon a sa fin (8 h apres le debut sans fin, comme les cartes de la page organisateur).
const isPast = (event: Event) => {
    if (event.lifecycle_status) {
        return event.lifecycle_status === EventLifecycleStatus.ENDED;
    }
    const end = event.end_date ? dayjs.utc(event.end_date) : dayjs.utc(event.start_date).add(8, 'hour');

    return end.isBefore(dayjs());
};

const byStart = (a: EventTickets, b: EventTickets) => dayjs.utc(a.event.start_date).diff(dayjs.utc(b.event.start_date));

const orderPath = (event: Event, order: Order) => `/checkout/${event.id}/${order.short_id}/summary`;

const EventCover = ({event, className}: { event: Event, className: string }) => {
    const cover = eventCoverImageUrl(event);

    return (
        <Link to={eventHomepagePath(event)} className={className} data-rough tabIndex={-1} aria-hidden>
            {cover
                ? <img src={cover} alt="" loading="lazy"/>
                : <span className={classes.coverPlaceholder}><PublicIcon name={'calendrier'} size={36}/></span>}
        </Link>
    );
};

const EventHeading = ({event}: { event: Event }) => (
    <>
        {event.organizer && (
            <Link to={organizerHomepagePath(event.organizer)} className={classes.organizer}>{event.organizer.name}</Link>
        )}
        <h3 className={classes.eventTitle}>
            <Link to={eventHomepagePath(event)}>{event.title}</Link>
        </h3>
    </>
);

// A venir: l'evenement, ses commandes, et un billet a code QR par participant.
const UpcomingEvent = ({group: {event, orders, attendees}}: { group: EventTickets }) => {
    const place = getShortLocationDisplay(event.settings?.location_details);

    return (
        <article className={classes.event} data-rough>
            <div className={classes.eventHead}>
                <EventCover event={event} className={classes.cover}/>
                <div className={classes.eventInfo}>
                    <EventHeading event={event}/>
                    <ul className={classes.meta}>
                        <li>
                            <PublicIcon name={'calendrier'} size={18} className={classes.accentIcon}/>
                            {eventRangeLabel(event.start_date, event.end_date, event.timezone)}
                        </li>
                        {place && (
                            <li><PublicIcon name={'lieu-petit'} size={18} className={classes.accentIcon}/>{place}</li>
                        )}
                        <li>
                            <PublicIcon name={'billet'} size={18} className={classes.accentIcon}/>
                            {attendees.length} {attendees.length === 1 ? t`ticket` : t`tickets`}
                        </li>
                    </ul>
                    <div className={classes.actions}>
                        <Link to={eventHomepagePath(event)} className={`${classes.button} ${classes.buttonFilled}`}
                              data-rough="button">
                            {t`View Event`}
                            <PublicIcon name={'fleche'} size={18}/>
                        </Link>
                        {orders.map((order) => (
                            <Link key={order.short_id} to={orderPath(event, order)}
                                  className={`${classes.button} ${classes.buttonOutline}`} data-rough="button">
                                {orders.length > 1 ? `${t`Order`} ${order.public_id}` : t`View Order`}
                            </Link>
                        ))}
                        {orders.length === 1 && (
                            <Link to={`/order/${event.id}/${orders[0].short_id}/print`} target="_blank"
                                  className={`${classes.button} ${classes.buttonOutline}`} data-rough="button">
                                <PublicIcon name={'imprimer'} size={18}/>
                                {t`Print Tickets`}
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            <div className={classes.tickets}>
                {attendees.map((attendee) => (
                    <ConfirmationTicket key={attendee.public_id} attendee={attendee} event={event}/>
                ))}
            </div>
        </article>
    );
};

// Passe: une rangee, avec le code de chaque billet et le lien vers la commande.
const PastEvent = ({group: {event, orders, attendees}}: { group: EventTickets }) => {
    const place = getShortLocationDisplay(event.settings?.location_details);

    return (
        <article className={classes.past} data-rough>
            <EventCover event={event} className={classes.pastCover}/>
            <div className={classes.pastInfo}>
                <EventHeading event={event}/>
                <span className={classes.pastWhen}>
                    {shortDayLabel(event.start_date, event.timezone)}{place && ` · ${place}`}
                </span>
                <ul className={classes.codes}>
                    {attendees.map((attendee) => (
                        <li key={attendee.public_id} className={classes.code} data-rough>
                            <span>{attendee.first_name} {attendee.last_name}</span>
                            <a href={`/product/${event.id}/${attendee.short_id}`} target="_blank" rel="noreferrer"
                               title={t`View Ticket`}>
                                {attendee.public_id}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
            <div className={classes.pastActions}>
                {orders.map((order) => (
                    <Link key={order.short_id} to={orderPath(event, order)}
                          className={`${classes.button} ${classes.buttonOutline}`} data-rough="button">
                        {orders.length > 1 ? `${t`Order`} ${order.public_id}` : t`View Order`}
                    </Link>
                ))}
            </div>
        </article>
    );
};

// Un os du squelette: la place d'un texte, d'un bouton ou d'une image avant les billets.
const Bone = ({className = '', width, height}: { className?: string, width?: number | string, height?: number }) => (
    <span className={`${classes.bone} ${className}`} style={{width, height}}/>
);

const SkeletonEvent = ({tickets}: { tickets: number }) => (
    <div className={classes.event} data-rough>
        <div className={classes.eventHead}>
            <Bone className={classes.boneCover}/>
            <div className={classes.eventInfo}>
                <Bone width={120} height={14}/>
                <Bone width={'70%'} height={30}/>
                <div className={classes.meta}>
                    <Bone width={220}/>
                    <Bone width={160}/>
                    <Bone width={90}/>
                </div>
                <div className={classes.actions}>
                    <Bone className={classes.boneButton} width={150}/>
                    <Bone className={classes.boneButton} width={130}/>
                </div>
            </div>
        </div>
        <div className={classes.tickets}>
            {Array.from({length: tickets}, (_, i) => <Bone key={i} className={classes.boneTicket}/>)}
        </div>
    </div>
);

// Le tableau de bord, vide: il bat pendant le chargement, et reste fige sous le courriel.
const DashboardSkeleton = ({loading}: { loading: boolean }) => (
    <div className={classes.skeleton} data-loading={loading || undefined} aria-hidden>
        <div className={`${shell.card} ${classes.hero}`} data-rough>
            <Bone width={170} height={26}/>
            <Bone width={340} height={56}/>
            <Bone width={240}/>
        </div>
        <div className={`${shell.card} ${shell.section}`} data-rough>
            <div className={shell.sectionHeader}>
                <Bone width={220} height={32}/>
                <div className={shell.tabs}>
                    <Bone className={classes.boneTab} width={130}/>
                    <Bone className={classes.boneTab} width={110}/>
                </div>
            </div>
            <div className={classes.list}>
                <SkeletonEvent tickets={2}/>
                <SkeletonEvent tickets={1}/>
            </div>
        </div>
    </div>
);

// Sans lien valide (page ouverte depuis « Mes billets », lien expire): le courriel de
// l'achat, par-dessus le tableau de bord, et le lien part par courriel.
const EmailOverlay = ({expired, message}: { expired: boolean, message?: string }) => {
    const [sent, setSent] = useState(false);
    const navigate = useNavigate();
    const lookup = useSendTicketLookupEmail();
    const form = useForm({initialValues: {email: ''}});

    // Sur dev, sans courriel, l'API rend le lien: on y va directement.
    const requestLink = ({email}: { email: string }) => {
        lookup.mutate(email, {
            onSuccess: ({token}) => token ? navigate(`/my-tickets/${token}`) : setSent(true),
            onError: () => showError(t`Something went wrong. Please try again.`),
        });
    };

    return (
        <div className={classes.overlay}>
            <div className={classes.dialogShadow}>
                <section className={classes.dialog} data-rough aria-labelledby="my-tickets-lookup">
                    {!expired && <p className={classes.kicker}>{t`See you outside!`}</p>}
                    <h1 id="my-tickets-lookup" className={classes.title}>
                        {expired ? t`Link Expired or Invalid` : t`My tickets`}
                    </h1>
                    {sent ? (
                        <div className={classes.sent}>
                            <p>{t`Check your inbox! If tickets are associated with this email, you'll receive a link to view them.`}</p>
                            <UnstyledButton className={classes.resetLink} onClick={() => {
                                setSent(false);
                                form.reset();
                            }}>
                                {t`Try another email`}
                            </UnstyledButton>
                        </div>
                    ) : (
                        <>
                            <p className={classes.line}>
                                {expired
                                    ? message || t`This link is invalid or has expired.`
                                    : t`No account needed: just the email you used at checkout.`}
                            </p>
                            <form className={classes.requestForm} onSubmit={form.onSubmit(requestLink)}>
                                <TextInput {...form.getInputProps('email')} type="email" required
                                           placeholder={t`Enter your email`} aria-label={t`Email`}
                                           className={classes.requestInput}/>
                                <Button type="submit" loading={lookup.isPending} className={classes.requestButton}>
                                    {expired ? t`Request a new link` : t`Send`}
                                </Button>
                            </form>
                        </>
                    )}
                </section>
            </div>
        </div>
    );
};

// Les prochains evenements de la billetterie, pour en decouvrir d'autres depuis ses billets: les
// cartes des pages organisateur, sans ceux dont on a deja des billets.
const DiscoverEvents = ({owned}: { owned: Set<string> }) => {
    const {data: events = []} = useGetUpcomingEventsPublic();
    const shown = events.filter((event) => !owned.has(String(event.id)));

    if (!shown.length) {
        return null;
    }

    return (
        <section className={`${shell.card} ${shell.section}`} data-rough aria-labelledby="discover-events-title">
            <div className={shell.sectionHeader}>
                <h2 id="discover-events-title" className={shell.sectionTitle}>{t`Discover events`}</h2>
            </div>
            <div className={classes.discover}>
                {shown.map((event) => <EventCard key={event.id} event={event} compact/>)}
            </div>
        </section>
    );
};

/**
 * Le tableau de bord du participant, ouvert par le lien du courriel « Vos billets »:
 * comme les pages publiques des organisateurs, aux couleurs de la Billetterie Dehors.
 * Sans lien (« Mes billets » de la barre) ou avec un lien expire, son squelette reste
 * sous une carte qui demande le courriel de l'achat.
 * Les evenements a venir montrent leurs billets a code QR; les passes, une rangee avec
 * les codes. Les onglets passent par ?vue=, comme les evenements passes de l'organisateur.
 * En bas, les prochains evenements de la billetterie, pour naviguer vers d'autres.
 */
export const MyTickets = () => {
    const {token} = useParams();
    const [searchParams] = useSearchParams();
    const roughEdges = useRoughEdges<HTMLElement>();
    const {data: orders, isLoading, isError, error} = useGetOrdersByLookupToken(token);
    const navigate = useNavigate();

    // L'app installee s'ouvre sur /my-tickets (le manifeste): elle reprend le dernier lien.
    useEffect(() => {
        if (token || !isInstalledApp()) {
            return;
        }
        try {
            const saved = localStorage.getItem(SAVED_LINK_KEY);
            if (saved) {
                navigate(`/my-tickets/${saved}`, {replace: true});
            }
        } catch {
            // localStorage indisponible: le courriel, comme dans le navigateur.
        }
    }, [token]);

    useEffect(() => {
        try {
            if (token && orders) {
                localStorage.setItem(SAVED_LINK_KEY, token);
            } else if (token && isError && localStorage.getItem(SAVED_LINK_KEY) === token) {
                localStorage.removeItem(SAVED_LINK_KEY);
            }
        } catch {
            // localStorage indisponible
        }
    }, [token, orders, isError]);

    const locked = !token || isError;

    const groups = groupByEvent(orders ?? []);
    const upcoming = groups.filter((group) => !isPast(group.event)).sort(byStart);
    const past = groups.filter((group) => isPast(group.event)).sort((a, b) => byStart(b, a));
    const upcomingCount = upcoming.length;
    const pastCount = past.length;
    const view = searchParams.get('vue');
    const showPast = view === 'passes' || (view !== 'a-venir' && !upcomingCount && pastCount > 0);
    const email = orders?.[0]?.email;

    return (
        <main ref={roughEdges} className={shell.page}>
            <Helmet>
                <link rel="manifest" href="/my-tickets.webmanifest"/>
            </Helmet>
            <style>
                {`
                    body, .ssr-loader {
                        background-color: var(--dehors-creme) !important;
                    }
                `}
            </style>

            <div className={shell.content}>
                <div className={shell.bar}>
                    {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                    <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}
                                   action={<InstallAppButton scope={'/my-tickets'}
                                                             subtitle={t`Your tickets and their QR codes in one tap, even at the door.`}/>}/>
                </div>

                {locked || isLoading ? (
                    <div className={classes.locked}>
                        <DashboardSkeleton loading={isLoading}/>
                        {locked && <EmailOverlay expired={isError} message={error?.message}/>}
                    </div>
                ) : (
                    <>
                        <header className={`${shell.card} ${classes.hero}`} data-rough>
                            <p className={classes.kicker}>{t`See you outside!`}</p>
                            <h1 className={classes.title}>{t`My tickets`}</h1>
                            {email && <p className={classes.line}>{t`Tickets bought with ${email}`}</p>}
                        </header>

                        <section className={`${shell.card} ${shell.section}`} data-rough aria-labelledby="my-tickets-title">
                            <div className={shell.sectionHeader}>
                                <h2 id="my-tickets-title" className={shell.sectionTitle}>
                                    <span className={shell.longLabel}>{showPast ? t`Past Events` : t`Upcoming Events`}</span>
                                    <span className={shell.shortLabel}>{showPast ? t`Past` : t`Upcoming`}</span>
                                </h2>
                                <nav className={shell.tabs}>
                                    <Link to={'?vue=a-venir'} replace className={shell.tab}
                                          aria-current={!showPast ? 'page' : undefined}>
                                        <span className={shell.longLabel}>{t`Upcoming (${upcomingCount})`}</span>
                                        <span className={shell.shortLabel}>{t`Upcoming`}</span>
                                    </Link>
                                    <Link to={'?vue=passes'} replace className={shell.tab}
                                          aria-current={showPast ? 'page' : undefined}>
                                        <span className={shell.longLabel}>{t`Past (${pastCount})`}</span>
                                        <span className={shell.shortLabel}>{t`Past`}</span>
                                    </Link>
                                </nav>
                            </div>

                            {(showPast ? past : upcoming).length === 0 ? (
                                <div className={shell.empty} data-rough>
                                    <PublicIcon name={'calendrier'} size={28} className={classes.accentIcon}/>
                                    <p>{showPast ? t`No past events` : t`No upcoming events`}</p>
                                </div>
                            ) : (
                                <div className={classes.list}>
                                    {showPast
                                        ? past.map((group) => <PastEvent key={group.event.id} group={group}/>)
                                        : upcoming.map((group) => <UpcomingEvent key={group.event.id} group={group}/>)}
                                </div>
                            )}
                        </section>
                    </>
                )}

                {!isLoading && <DiscoverEvents owned={new Set(groups.map((group) => String(group.event.id)))}/>}

                <PublicPageFooter/>
            </div>
        </main>
    );
};

export default MyTickets;
