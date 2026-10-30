import {t} from "@lingui/macro";
import {Link, useLocation, useNavigate, useParams, useSearchParams} from "react-router";
import {Button, TextInput, UnstyledButton} from "@mantine/core";
import {useForm} from "@mantine/form";
import {useEffect, useState} from "react";
import {Helmet} from "react-helmet-async";
import QRCode from "react-qr-code";
import dayjs from "dayjs";

import {useGetOrdersByLookupToken} from "../../../queries/useGetOrdersByLookupToken.ts";
import {useSendTicketLookupEmail} from "../../../mutations/useSendTicketLookupEmail.ts";
import {useGetUpcomingEventsPublic} from "../../../queries/useGetUpcomingEventsPublic.ts";
import {showError} from "../../../utilites/notifications.tsx";
import {backToMyTickets, eventCoverImageUrl, eventHomepagePath, organizerHomepagePath} from "../../../utilites/urlHelper.ts";
import {eventLocation, getShortLocationDisplay} from "../../../utilites/addressUtilities.ts";
import {getAttendeeProductTitle} from "../../../utilites/products.ts";
import {getConfig} from "../../../utilites/config.ts";

import {PublicBarLink, PublicPageBar} from "../../common/PublicPageBar";
import {PublicPageFooter} from "../../common/PublicPageFooter";
import {PublicIcon} from "../../common/PublicIcon";
import {InstallAppButton} from "../../common/InstallAppButton";
import {EventCard} from "../../layouts/OrganizerHomepage/EventCard";
import {CarouselList, CarouselNav} from "../../common/Carousel";
import {useCarousel} from "../../../hooks/useCarousel.ts";
import {ConfirmationTicket} from "../product-widget/OrderSummaryAndProducts/ConfirmationTicket";
import {
    dayMonthLabel,
    shortDayLabel,
    shortTimeLabel,
} from "../product-widget/OrderSummaryAndProducts/confirmationDates.ts";

import {Attendee, Event, EventLifecycleStatus, Order, Product} from "../../../types.ts";
import shell from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import classes from './MyTickets.module.scss';

// Le dernier lien valide de l'appareil, pour que l'app installee rouvre le tableau de bord.
const SAVED_LINK_KEY = 'dehors-mes-billets-lien';

// « Changer » (de courriel) et « Retrouver un billet »: le formulaire du courriel, meme dans
// l'app installee, qui sinon rouvre le dernier lien.
const OTHER_EMAIL_PARAM = 'autre-courriel';
const OTHER_EMAIL_PATH = `/my-tickets?${OTHER_EMAIL_PARAM}`;

// Les rangees de billets utilises et les cartes a decouvrir montrees avant « Voir tout »:
// moins sur telephone (le CSS cache le reste).
const SHOWN_DESKTOP = 3;
const SHOWN_MOBILE = 2;

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

const ticketCount = (count: number) => count === 1 ? t`1 ticket` : t`${count} tickets`;

const orderLabel = (order: Order) => {
    const id = order.public_id;

    return t`Order ${id}`;
};

// Le billet dont on montre le code QR: le premier qui en a un (ni annule, ni en attente de paiement).
const scannable = (attendees: Attendee[]) => attendees.find((attendee) => attendee.status === 'ACTIVE');

// Le premier passage a l'entree parmi les billets de l'evenement.
const firstCheckIn = (attendees: Attendee[]) => attendees
    .map((attendee) => attendee.checked_in_at)
    .filter((date): date is string => !!date)
    .sort()[0];

// « Aujourd'hui », « Demain », « Dans 2 jours », en jours du calendrier du fuseau de l'evenement.
const countdownLabel = (event: Event) => {
    const days = dayjs.utc(event.start_date).tz(event.timezone).startOf('day')
        .diff(dayjs().tz(event.timezone).startOf('day'), 'day');

    if (days <= 0) {
        return t`Today`;
    }

    return days === 1 ? t`Tomorrow` : t`In ${days} days`;
};

const Cover = ({event, className}: { event: Event, className: string }) => {
    const cover = eventCoverImageUrl(event);

    return (
        <span className={className}>
            {cover
                ? <img src={cover} alt="" loading="lazy"/>
                : <span className={classes.coverPlaceholder}><PublicIcon name={'calendrier'} size={28}/></span>}
        </span>
    );
};

// Les liens vers les billets: la commande (ses billets a code QR), une par commande s'il y en a plusieurs.
const TicketLinks = ({group: {event, orders, attendees}}: { group: EventTickets }) => (
    <div className={classes.ticketLinks}>
        {orders.map((order) => (
            <Link key={order.short_id} to={orderPath(event, order)} className={classes.textLink}>
                {orders.length > 1
                    ? orderLabel(order)
                    : attendees.length > 1 ? t`View tickets` : t`View Ticket`}
                <PublicIcon name={'fleche'} size={16}/>
            </Link>
        ))}
    </div>
);

// A venir, grand ecran: la carte de l'evenement; au survol (ou au clavier), la photo laisse
// place au code QR du billet.
const TicketCard = ({group}: { group: EventTickets }) => {
    const {event, orders, attendees} = group;
    const attendee = scannable(attendees);
    // La commande du billet montre: le code QR y mene.
    const order = orders.find((candidate) => candidate.id === attendee?.order_id) ?? orders[0];
    const place = getShortLocationDisplay(event.settings?.location_details);
    const productTitle = attendee && getAttendeeProductTitle(attendee, attendee.product as Product);
    // Le retour de la page de l'evenement ramene ici, plutot qu'a l'organisateur.
    const {pathname} = useLocation();
    const backState = backToMyTickets(pathname);

    return (
        <article className={classes.ticketCard} data-rough="stroke">
            <div className={classes.ticketMedia}>
                <Link to={eventHomepagePath(event)} state={backState} className={classes.ticketCover}
                      tabIndex={-1} aria-hidden>
                    <Cover event={event} className={classes.ticketPhoto}/>
                    <span className={classes.datePill}>
                        <PublicIcon name={'calendrier'} size={16} className={classes.accentIcon}/>
                        {shortDayLabel(event.start_date, event.timezone, false)}
                    </span>
                </Link>
                {attendee && (
                    <div className={classes.ticketQr}>
                        <Link to={orderPath(event, order)} className={classes.qrBox} aria-label={t`View Ticket`}>
                            <QRCode value={String(attendee.public_id)} size={152} level="M"
                                    fgColor="currentColor" bgColor="transparent"/>
                        </Link>
                        <span className={classes.qrCaption} aria-hidden>
                            {[productTitle, attendee.public_id].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                )}
            </div>

            <div className={classes.ticketText}>
                {event.organizer && (
                    <Link to={organizerHomepagePath(event.organizer)} className={classes.organizer}>
                        {event.organizer.name}
                    </Link>
                )}
                <h3 className={classes.ticketTitle}>
                    <Link to={eventHomepagePath(event)} state={backState}>{event.title}</Link>
                </h3>
                <p className={classes.ticketLine}>
                    <PublicIcon name={'horloge'} size={17} className={classes.accentIcon}/>
                    {shortDayLabel(event.start_date, event.timezone)} · {shortTimeLabel(event.start_date, event.timezone)}
                </p>
                {place && (
                    <p className={classes.ticketLine}>
                        <PublicIcon name={'lieu-petit'} size={17} className={classes.accentIcon}/>
                        {place}
                    </p>
                )}
                <div className={classes.ticketBottom}>
                    <span className={classes.pill}>
                        <PublicIcon name={'billet'} size={16} className={classes.accentIcon}/>
                        {ticketCount(attendees.length)}
                    </span>
                    <TicketLinks group={group}/>
                </div>
            </div>
        </article>
    );
};

// Un billet introuvable: on nous ecrit, le courriel deja prepare (l'evenement et le courriel de l'achat a remplir).
const MissingTicket = () => {
    const supportEmail = getConfig('VITE_PLATFORM_SUPPORT_EMAIL', 'support@dehorsqc.com');
    const subject = t`Ticket not found`;
    const body = `${t`Event:`} \n${t`Email used at checkout:`} \n`;
    const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    return (
        <div className={classes.missing}>
            <span className={classes.missingIcon}><PublicIcon name={'courriel'} size={24}/></span>
            <p className={classes.missingTitle}>{t`Can't find a ticket?`}</p>
            <p className={classes.missingText}>
                {t`Send us the event name and the email used at checkout, and we'll find it for you.`}
            </p>
            <a href={mailto} className={`${classes.button} ${classes.buttonOutline}`} data-rough="button">
                {t({message: 'Write to us', context: 'ticket buyer'})}
            </a>
            <span className={classes.missingEmail}>{supportEmail}</span>
        </div>
    );
};

const NoUpcoming = () => (
    <div className={`${shell.empty} ${classes.empty}`}>
        <PublicIcon name={'calendrier'} size={28} className={classes.accentIcon}/>
        <p>{t`No upcoming events`}</p>
    </div>
);

// A venir, grand ecran: les billets en carrousel, comme le repertoire (fleches dans l'en-tete),
// et la carte du billet manquant au bout.
const UpcomingGrid = ({groups}: { groups: EventTickets[] }) => {
    const count = groups.reduce((total, group) => total + group.attendees.length, 0);
    const carousel = useCarousel(groups.length + 1);

    return (
        <section className={`${shell.card} ${classes.section} ${classes.desktopOnly}`} data-rough
                 aria-labelledby="upcoming-title">
            <div className={classes.sectionHeader}>
                <div className={classes.sectionHeading}>
                    <h2 id="upcoming-title" className={classes.sectionTitle}>{t`Upcoming`}</h2>
                    {count > 0 && (
                        <span className={classes.sectionNote}>
                            {count === 1 ? t`1 upcoming ticket` : t`${count} upcoming tickets`}
                        </span>
                    )}
                </div>
                <CarouselNav carousel={carousel}/>
            </div>
            {count > 0 && (
                <p className={classes.tip}>
                    <PublicIcon name={'qr'} size={18} className={classes.darkIcon}/>
                    {t`Hover over a ticket to show its QR code.`}
                </p>
            )}
            <CarouselList carousel={carousel}>
                {groups.length === 0 && <li><NoUpcoming/></li>}
                {groups.map((group) => <li key={group.event.id}><TicketCard group={group}/></li>)}
                <li><MissingTicket/></li>
            </CarouselList>
        </section>
    );
};

// Telephone: le prochain evenement, ses billets a code QR tout de suite, puis l'itineraire et la commande.
const NextEvent = ({group}: { group?: EventTickets }) => {
    if (!group) {
        return (
            <section className={`${shell.card} ${classes.section} ${classes.mobileOnly}`} data-rough
                     aria-labelledby="next-title">
                <h2 id="next-title" className={classes.sectionTitle}>{t`Upcoming`}</h2>
                <NoUpcoming/>
                <Link to={OTHER_EMAIL_PATH}
                      className={`${classes.button} ${classes.buttonOutline} ${classes.buttonLarge}`} data-rough="button">
                    {t`Find a ticket`}
                </Link>
            </section>
        );
    }

    const {event, orders, attendees} = group;
    const location = eventLocation(event);

    return (
        <section className={`${shell.card} ${classes.next} ${classes.mobileOnly}`} data-rough aria-labelledby="next-title">
            <div className={classes.nextHeader}>
                <h2 id="next-title" className={classes.sectionTitle}>{t`Next`}</h2>
                <span className={classes.countdown}>
                    <PublicIcon name={'soleil'} size={15}/>
                    {countdownLabel(event)}
                </span>
            </div>
            <div className={classes.nextTickets}>
                {attendees.map((attendee) => (
                    <ConfirmationTicket key={attendee.public_id} attendee={attendee} event={event} compact/>
                ))}
            </div>
            <div className={classes.nextActions}>
                {location && (
                    <a href={location.mapsUrl} target="_blank" rel="noreferrer"
                       className={`${classes.button} ${classes.buttonOutline} ${classes.buttonLarge}`} data-rough="button">
                        <PublicIcon name={'itineraire'} size={18}/>
                        {t`Directions`}
                    </a>
                )}
                {orders.map((order) => (
                    <Link key={order.short_id} to={orderPath(event, order)}
                          className={`${classes.button} ${classes.buttonOutline} ${classes.buttonLarge}`} data-rough="button">
                        <PublicIcon name={'billet'} size={18}/>
                        {orders.length > 1 ? orderLabel(order) : t`Details`}
                    </Link>
                ))}
            </div>
        </section>
    );
};

// Telephone: les autres evenements a venir, en rangees qui ouvrent leurs billets.
const AlsoUpcoming = ({groups}: { groups: EventTickets[] }) => (
    <section className={`${shell.card} ${classes.section} ${classes.mobileOnly}`} data-rough
             aria-labelledby="also-upcoming-title">
        <h2 id="also-upcoming-title" className={classes.sectionTitle}>{t`Also upcoming`}</h2>
        <ul className={classes.rows}>
            {groups.map(({event, orders, attendees}) => (
                <li key={event.id}>
                    <Link to={orderPath(event, orders[0])} className={classes.row}>
                        <Cover event={event} className={classes.rowPhoto}/>
                        <span className={classes.rowText}>
                            <span className={classes.rowTitle}>{event.title}</span>
                            <span className={classes.rowLine}>
                                {[event.organizer?.name, shortDayLabel(event.start_date, event.timezone), ticketCount(attendees.length)]
                                    .filter(Boolean).join(' · ')}
                            </span>
                        </span>
                        <span className={classes.rowArrow} aria-hidden><PublicIcon name={'fleche'} size={18}/></span>
                    </Link>
                </li>
            ))}
        </ul>
    </section>
);

// Passe: la rangee de l'evenement, et « Utilise » quand un billet a ete scanne a l'entree.
const scannedLabels = (scannedAt: string, timezone: string) => {
    const day = shortDayLabel(scannedAt, timezone, false);
    const time = shortTimeLabel(scannedAt, timezone);
    const shortDay = dayMonthLabel(scannedAt, timezone);

    return {desktop: t`Scanned on ${day} at ${time}`, mobile: t`Scanned on ${shortDay}`};
};

const UsedRow = ({group: {event, orders, attendees}}: { group: EventTickets }) => {
    const scannedAt = firstCheckIn(attendees);
    const organizer = event.organizer?.name;
    const scanned = scannedAt ? scannedLabels(scannedAt, event.timezone) : null;
    const desktopWhen = scanned?.desktop ?? shortDayLabel(event.start_date, event.timezone);
    const mobileWhen = scanned?.mobile ?? dayMonthLabel(event.start_date, event.timezone);

    return (
        <li>
            <Link to={orderPath(event, orders[0])} className={classes.row}>
                <Cover event={event} className={`${classes.rowPhoto} ${classes.usedPhoto}`}/>
                <span className={classes.rowText}>
                    <span className={classes.rowTitle}>{event.title}</span>
                    <span className={`${classes.rowLine} ${classes.desktopOnly}`}>
                        {[organizer, desktopWhen].filter(Boolean).join(' · ')}
                    </span>
                    <span className={`${classes.rowLine} ${classes.mobileOnly}`}>
                        {[mobileWhen, organizer].filter(Boolean).join(' · ')}
                    </span>
                </span>
                {scannedAt && (
                    <span className={classes.usedPill}>
                        <PublicIcon name={'coche'} size={16} className={classes.accentIcon}/>
                        {t({message: 'Used', context: 'scanned ticket'})}
                    </span>
                )}
                <PublicIcon name={'chevron-droite'} size={18} className={`${classes.rowChevron} ${classes.desktopOnly}`}/>
            </Link>
        </li>
    );
};

const UsedTickets = ({groups}: { groups: EventTickets[] }) => {
    const [expanded, setExpanded] = useState(false);
    const total = groups.length;
    const thisYear = groups.filter((group) => dayjs.utc(group.event.start_date).year() === dayjs().year()).length;

    return (
        <section className={`${shell.card} ${classes.section} ${classes.used}`} data-rough aria-labelledby="used-title">
            <div className={classes.sectionHeader}>
                <h2 id="used-title" className={classes.sectionTitle}>{t`Used tickets`}</h2>
                {thisYear > 0 && (
                    <span className={`${classes.sectionNote} ${classes.desktopOnly}`}>
                        {thisYear === 1 ? t`1 outing this year` : t`${thisYear} outings this year`}
                    </span>
                )}
            </div>
            <ul className={classes.rows} data-expanded={expanded || undefined}>
                {groups.map((group) => <UsedRow key={group.event.id} group={group}/>)}
            </ul>
            {!expanded && total > SHOWN_MOBILE && (
                <UnstyledButton className={classes.moreLink} onClick={() => setExpanded(true)}
                                data-desktop={total > SHOWN_DESKTOP || undefined}>
                    {t`See all ${total} used tickets`}
                </UnstyledButton>
            )}
        </section>
    );
};

// Un os du squelette: la place d'un texte, d'un bouton ou d'une image avant les billets.
const Bone = ({className = '', width, height}: { className?: string, width?: number | string, height?: number }) => (
    <span className={`${classes.bone} ${className}`} style={{width, height}}/>
);

const SkeletonTicket = () => (
    <div className={classes.boneCard}>
        <Bone className={classes.boneCover}/>
        <Bone width={90} height={13}/>
        <Bone width={'75%'} height={22}/>
        <Bone width={150}/>
        <Bone width={120}/>
    </div>
);

// Le tableau de bord, vide: il bat pendant le chargement (sous le vrai en-tete), et reste fige
// sous le courriel, en-tete compris (la fenetre a deja son titre).
const DashboardSkeleton = ({locked = false}: { locked?: boolean }) => (
    <div className={classes.skeleton} data-loading={!locked || undefined} aria-hidden>
        {locked && (
            <div className={`${shell.card} ${classes.hero}`} data-rough>
                <Bone width={170} height={26}/>
                <Bone width={340} height={56}/>
                <Bone width={240}/>
            </div>
        )}
        <div className={`${shell.card} ${classes.section}`} data-rough>
            <div className={classes.sectionHeader}>
                <Bone width={160} height={30}/>
                <Bone width={110}/>
            </div>
            <div className={classes.ticketGrid}>
                <SkeletonTicket/>
                <SkeletonTicket/>
                <SkeletonTicket/>
            </div>
        </div>
    </div>
);

// L'en-tete ne depend pas des billets: il s'affiche tout de suite, seul le courriel attend la commande.
const Hero = ({email, loading}: { email?: string, loading: boolean }) => (
    <header className={`${shell.card} ${classes.hero}`} data-rough>
        <img src={'/landing/stickers/autocollant-sapin.webp'} alt="" aria-hidden
             className={classes.stickerPine}/>
        <p className={classes.kicker}>{t`See you outside!`}</p>
        <h1 className={classes.title}>
            <span className={classes.titleText}>
                {t`My tickets`}
                <img src={'/landing/stickers/autocollant-drapeau-dehors.webp'} alt="" aria-hidden
                     className={classes.stickerFlag}/>
            </span>
        </h1>
        {loading ? (
            <p className={classes.line} aria-hidden><Bone className={classes.boneLine}/></p>
        ) : email && (
            <p className={classes.line}>
                <PublicIcon name={'courriel'} size={18} className={`${classes.accentIcon} ${classes.desktopOnly}`}/>
                <span>{t`Tickets linked to ${email}`}</span>
                <Link to={OTHER_EMAIL_PATH} className={classes.change}>{t`Change`}</Link>
            </p>
        )}
    </header>
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
// petites cartes des pages organisateur, sans ceux dont on a deja des billets, et d'abord ceux
// des organisateurs avec qui on est deja sorti. « Voir tous les evenements » mene au repertoire.
const DiscoverEvents = ({groups, suggested}: { groups: EventTickets[], suggested: boolean }) => {
    const {data: events = []} = useGetUpcomingEventsPublic();
    const owned = new Set(groups.map((group) => String(group.event.id)));
    const known = new Set(groups.flatMap((group) => group.event.organizer ? [String(group.event.organizer.id)] : []));
    const shown = events
        .filter((event) => !owned.has(String(event.id)))
        .sort((a, b) => Number(known.has(String(b.organizer?.id))) - Number(known.has(String(a.organizer?.id))));

    if (!shown.length) {
        return null;
    }

    return (
        <section className={`${shell.card} ${classes.section}`} data-rough aria-labelledby="discover-events-title">
            <div className={classes.sectionHeader}>
                <h2 id="discover-events-title" className={classes.sectionTitle}>
                    <span className={shell.longLabel}>{t`Discover events`}</span>
                    <span className={shell.shortLabel}>{t`Discover`}</span>
                </h2>
                <Link to={'/events'}
                      className={`${classes.button} ${classes.buttonOutline} ${classes.buttonLarge} ${classes.seeAll}`} data-rough="button">
                    <span className={shell.longLabel}>{t`See all events`}</span>
                    <span className={shell.shortLabel}>{t`See all`}</span>
                    <PublicIcon name={'fleche'} size={18}/>
                </Link>
            </div>
            {suggested && known.size > 0 && (
                <p className={`${classes.sectionNote} ${classes.desktopOnly}`}>{t`Suggestions based on your past outings.`}</p>
            )}
            <div className={classes.discover}>
                {shown.map((event) => <EventCard key={event.id} event={event} compact/>)}
            </div>
        </section>
    );
};

/**
 * Le tableau de bord du participant, ouvert par le lien du courriel « Vos billets »
 * (maquette Figma « Public · Mes billets »), aux couleurs de la Billetterie Dehors.
 * Sans lien (« Mes billets » de la barre) ou avec un lien expire, son squelette reste
 * sous une carte qui demande le courriel de l'achat.
 * Grand ecran: les billets a venir en grille (code QR au survol), puis les billets utilises.
 * Telephone: le prochain evenement et ses codes QR d'abord, les autres en rangees.
 * En bas, les prochains evenements de la billetterie, pour naviguer vers d'autres.
 */
export const MyTickets = () => {
    const {token} = useParams();
    const [searchParams] = useSearchParams();
    const {data: orders, isLoading, isError, error} = useGetOrdersByLookupToken(token);
    const navigate = useNavigate();
    const otherEmail = searchParams.has(OTHER_EMAIL_PARAM);

    // L'app installee s'ouvre sur /my-tickets (le manifeste): elle reprend le dernier lien.
    useEffect(() => {
        if (token || otherEmail || !isInstalledApp()) {
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
    }, [token, otherEmail]);

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
    const email = orders?.[0]?.email;

    return (
        <main className={`${shell.page} ${classes.page}`}>
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

            <div className={`${shell.content} ${classes.content}`}>
                <div className={shell.bar}>
                    {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                    <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}
                                   action={<InstallAppButton scope={'/my-tickets'}
                                                             subtitle={t`Your tickets and their QR codes in one tap, even at the door.`}/>}/>
                </div>

                {locked ? (
                    <div className={classes.locked}>
                        <DashboardSkeleton locked/>
                        <EmailOverlay expired={isError} message={error?.message}/>
                    </div>
                ) : (
                    <>
                        <Hero email={email} loading={isLoading}/>
                        {isLoading ? <DashboardSkeleton/> : (
                            <>
                                <UpcomingGrid groups={upcoming}/>
                                <NextEvent group={upcoming[0]}/>
                                {upcoming.length > 1 && <AlsoUpcoming groups={upcoming.slice(1)}/>}
                                {past.length > 0 && <UsedTickets groups={past}/>}
                            </>
                        )}
                    </>
                )}

                {!isLoading && <DiscoverEvents groups={groups} suggested={past.length > 0}/>}

                <PublicPageFooter/>
            </div>
        </main>
    );
};

export default MyTickets;
