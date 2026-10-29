import classes from "./EventPage.module.scss";
import "../../../styles/widget/default.scss";
import React, {useEffect, useRef, useState} from "react";
import {Link} from "react-router";
import {t} from "@lingui/macro";
import {IconHeart, IconWorld} from "@tabler/icons-react";
import {EventDocumentHead} from "../../common/EventDocumentHead";
import {eventCoverImage, eventHomepageUrl, organizerHomepagePath} from "../../../utilites/urlHelper.ts";
import {Event, Organizer, OrganizerStatus} from "../../../types.ts";
import {EventNotAvailable} from "./EventNotAvailable";
import {ContactOrganizerModal} from "../../common/ContactOrganizerModal";
import {socialMediaConfig} from "../../../constants/socialMediaConfig";
import {EventCategories} from "../../../constants/eventCategories.ts";
import {
    formatAddress,
    getGoogleMapsUrl,
    getShortLocationDisplay,
    isAddressSet
} from "../../../utilites/addressUtilities.ts";
import {StatusToggle} from "../../common/StatusToggle";
import {computeThemeVariables, validateThemeSettings} from "../../../utilites/themeUtils.ts";
import {useOrganizerTrackingPixels} from "../../../hooks/useOrganizerTrackingPixels";
import {hasActivePixels, trackPixelEvent} from "../../../utilites/trackingPixels";
import {CookieConsentBanner} from "../../common/CookieConsentBanner";
import {ShareComponent} from "../../common/ShareIcon";
import {CalendarOptionsPopover} from "../../common/CalendarOptionsPopover";
import {formatDateWithLocale, isDateInPast} from "../../../utilites/dates.ts";
import {useLingui} from "@lingui/react";
import {PublicBarLink, PublicPageBar} from "../../common/PublicPageBar";
import {PublicPageFooter} from "../../common/PublicPageFooter";
import {PublicIcon} from "../../common/PublicIcon";
import {ProductSelectionSummary} from "../../routes/product-widget/SelectProducts";
import {findDefaultTicket, StickyBuyBar} from "./StickyBuyBar";
import {TicketsCard} from "./TicketsCard";
import {CollapsibleDescription} from "./CollapsibleDescription";
import {useRoughEdges} from "../../../hooks/useRoughEdges.ts";

const TICKETS_FORM_ID = 'event-tickets-form';

interface EventHomepageProps {
    event?: Event;
    promoCodeValid?: boolean;
    promoCode?: string;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// « Ven. 30 oct. 2026 18:00 → sam. 31 oct. 2026 16:00 », le fuseau a part, comme la maquette.
// La langue vient de Lingui (la meme au serveur et au client, pas d'erreur d'hydratation).
const formatEventDates = (event: Event, locale: string) => {
    const isSameDay = event.end_date && event.start_date.substring(0, 10) === event.end_date.substring(0, 10);

    if (isSameDay) {
        const day = formatDateWithLocale(event.start_date, 'dayName', event.timezone, locale);
        const start = formatDateWithLocale(event.start_date, 'timeOnly', event.timezone, locale);
        const end = formatDateWithLocale(event.end_date!, 'timeOnly', event.timezone, locale);
        return capitalize(`${day} · ${start} → ${end}`);
    }

    const start = formatDateWithLocale(event.start_date, 'fullDateTime', event.timezone, locale);
    const end = event.end_date ? formatDateWithLocale(event.end_date, 'fullDateTime', event.timezone, locale) : null;
    return capitalize(end ? `${start} → ${end}` : start);
};

// « Heure de l'Est (HAE) »: les noms canadiens des fuseaux.
const formatEventTimezone = (event: Event, locale: string) => {
    const timezoneName = (style: 'longGeneric' | 'short') => new Intl.DateTimeFormat(`${locale.split('-')[0]}-CA`, {
        timeZone: event.timezone,
        timeZoneName: style,
    }).formatToParts(new Date(event.start_date)).find(part => part.type === 'timeZoneName')?.value;

    try {
        const name = timezoneName('longGeneric');
        const abbreviation = timezoneName('short');
        if (name && abbreviation && name !== abbreviation) {
            return `${capitalize(name)} (${abbreviation})`;
        }
        return name || abbreviation || event.timezone;
    } catch {
        return event.timezone;
    }
};

const OrganizerLogo = ({organizer, className}: { organizer?: Organizer, className: string }) => {
    const logo = organizer?.images?.find(image => image.type === 'ORGANIZER_LOGO')?.url;

    return logo
        ? <img src={logo} alt="" className={className} data-rough/>
        : <span className={className} aria-hidden data-rough>{organizer?.name?.charAt(0).toUpperCase() || '?'}</span>;
};

const EventHomepage = ({event, promoCodeValid, promoCode}: EventHomepageProps) => {
    const [ticketsOutOfView, setTicketsOutOfView] = useState(false);
    const [contactModalOpen, setContactModalOpen] = useState(false);
    const [selection, setSelection] = useState<ProductSelectionSummary | null>(null);
    const ticketsRef = useRef<HTMLElement>(null);
    const {i18n} = useLingui();
    const roughEdges = useRoughEdges<HTMLElement>();

    const {consentPending, consentGranted, onConsent} = useOrganizerTrackingPixels(
        event?.organizer?.settings?.tracking_pixels
    );

    useEffect(() => {
        if (event && consentGranted && hasActivePixels()) {
            trackPixelEvent({
                eventName: 'ViewContent',
                contentName: event.title,
                contentId: event.id,
            });
        }
    }, [event?.id, consentGranted]);

    useEffect(() => {
        const checkTicketsPosition = () => {
            if (ticketsRef.current) {
                const rect = ticketsRef.current.getBoundingClientRect();
                setTicketsOutOfView(rect.top > window.innerHeight || rect.bottom < 0);
            }
        };

        const showTimer = setTimeout(checkTicketsPosition, 500);
        window.addEventListener('scroll', checkTicketsPosition);
        window.addEventListener('resize', checkTicketsPosition);

        return () => {
            clearTimeout(showTimer);
            window.removeEventListener('scroll', checkTicketsPosition);
            window.removeEventListener('resize', checkTicketsPosition);
        };
    }, []);

    const scrollToTickets = () => {
        ticketsRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
    };

    if (!event) {
        return <EventNotAvailable/>;
    }

    // Seule la couleur principale suit l'organisateur (dehors-app.scss en tire les --public-*);
    // le creme et le brun restent fixes. Sans theme, l'orange Dehors.
    const themeSettings = event.settings?.homepage_theme_settings;
    const themeVariables = themeSettings?.accent ? computeThemeVariables(validateThemeSettings(themeSettings)) : null;
    const pageStyle = (themeVariables ? {
        '--theme-accent': themeVariables['--theme-accent'],
        '--theme-accent-contrast': themeVariables['--theme-accent-contrast'],
    } : undefined) as React.CSSProperties | undefined;

    const coverImage = eventCoverImage(event);
    const organizer = event.organizer!;
    const organizerIsLive = organizer?.status === OrganizerStatus.LIVE;
    const organizerLocation = getShortLocationDisplay(organizer?.settings?.location_details);
    const locationDetails = event.settings?.location_details;
    const isOnlineEvent = event.settings?.is_online_event;
    const hasLocation = isAddressSet(locationDetails) && !isOnlineEvent;
    const mapUrl = event.settings?.maps_url || (locationDetails ? getGoogleMapsUrl(locationDetails) : null);
    const hasEnded = !!event.end_date && isDateInPast(event.end_date);

    const products = event.products || event.product_categories?.flatMap(c => c.products || []) || [];
    const defaultTicket = findDefaultTicket(event);
    const hasOtherProducts = (event.product_categories?.flatMap(c => c.products || []) || []).length > 1;

    const tags: string[] = [];
    const category = EventCategories.find(item => item.id === event.category && item.id !== 'OTHER');
    if (category) {
        tags.push(category.name);
    }
    if (isOnlineEvent) {
        tags.push(t`Online Event`);
    }
    if (products.length > 0) {
        if (products.every(p => p.is_sold_out)) {
            tags.push(t`Sold Out`);
        } else if (products.some(p => p.is_available && !p.is_sold_out)) {
            tags.push(t`Tickets Available`);
        }
    }

    const socialLinks = Object.entries(organizer?.settings?.social_media_handles || {})
        .filter(([platform, handle]) => handle && socialMediaConfig[platform as keyof typeof socialMediaConfig])
        .map(([platform, handle]) => ({
            platform,
            url: socialMediaConfig[platform as keyof typeof socialMediaConfig].baseUrl + handle,
            Icon: socialMediaConfig[platform as keyof typeof socialMediaConfig].icon,
        }));
    const websiteHost = (() => {
        try {
            return organizer?.website ? new URL(organizer.website).hostname : null;
        } catch {
            return null;
        }
    })();
    const hasOrganizerLinks = socialLinks.length > 0 || !!websiteHost || !!organizer?.donation_url;

    const shareButton = (className: string, withLabel: boolean) => (
        <ShareComponent
            title={'Check out this event: ' + event.title}
            text={'Check out this event: ' + event.title}
            url={eventHomepageUrl(event)}
            imageUrl={coverImage?.url}
        >
            <button type="button" className={className} title={t`Share`} aria-label={t`Share`} data-rough="button">
                <PublicIcon name={'partager'} size={withLabel ? 20 : 18}/>
                {withLabel && t`Share`}
            </button>
        </ShareComponent>
    );

    const organizerBackLink = organizerIsLive && (
        <PublicBarLink to={organizerHomepagePath(organizer)}>
            <PublicIcon name={'retour'} className={classes.accentIcon}/>
            {t`All events by ${organizer.name}`}
        </PublicBarLink>
    );

    return (
        <>
            {event?.status && event?.id && (
                <StatusToggle
                    entityType="event"
                    entityId={event.id}
                    currentStatus={event.status as 'DRAFT' | 'LIVE'}
                    entityName={event.title}
                    onSuccess={() =>
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000)}
                />
            )}

            <main ref={roughEdges} className={classes.page} style={pageStyle}>
                <style>
                    {`
                        body, .ssr-loader {
                            background-color: var(--dehors-orange-fond) !important;
                        }
                    `}
                </style>

                <EventDocumentHead event={event}/>

                <div className={classes.content}>
                    <div className={classes.bar}>
                        <PublicPageBar left={organizerBackLink}/>
                    </div>

                    <div className={classes.columns}>
                        <div className={classes.eventColumn}>
                            <section className={`${classes.card} ${classes.presentation}`} data-rough>
                                {coverImage && (
                                    <div
                                        className={classes.cover} data-rough
                                        style={(coverImage.width && coverImage.height) ? {
                                            '--cover-ratio': `${coverImage.width} / ${coverImage.height}`,
                                        } as React.CSSProperties : undefined}
                                    >
                                        {coverImage.lqip_base64 && (
                                            <img src={coverImage.lqip_base64} alt="" aria-hidden className={classes.coverLqip}/>
                                        )}
                                        <img src={coverImage.url} alt={event.title} className={classes.coverImage}/>

                                        {/* Sur mobile, le retour et le partage passent sur l'image. */}
                                        <div className={classes.coverActions}>
                                            {organizerIsLive ? (
                                                <Link to={organizerHomepagePath(organizer)} className={classes.coverBack} data-rough="button">
                                                    <PublicIcon name={'retour'} size={15} className={classes.accentIcon}/>
                                                    <span>{organizer.name}</span>
                                                </Link>
                                            ) : <span/>}
                                            {shareButton(classes.coverShare, false)}
                                        </div>
                                    </div>
                                )}

                                <div className={classes.heading}>
                                    <div className={`${classes.organizerRow} ${coverImage ? classes.organizerRowWithCover : ''}`}>
                                        {organizerIsLive ? (
                                            <Link to={organizerHomepagePath(organizer)} className={classes.organizerPill} data-rough>
                                                <OrganizerLogo organizer={organizer} className={classes.organizerPillLogo}/>
                                                {organizer.name}
                                            </Link>
                                        ) : (
                                            <span className={classes.organizerPill} data-rough>
                                                <OrganizerLogo organizer={organizer} className={classes.organizerPillLogo}/>
                                                {organizer?.name}
                                            </span>
                                        )}
                                        {shareButton(classes.outlineButton, true)}
                                    </div>

                                    <h1 className={classes.title}>{event.title}</h1>

                                    {tags.length > 0 && (
                                        <ul className={classes.tags}>
                                            {tags.map(tag => <li key={tag} className={classes.tag} data-rough>{tag}</li>)}
                                        </ul>
                                    )}
                                </div>
                            </section>

                            <section className={`${classes.card} ${classes.details}`} data-rough>
                                <div className={classes.detail}>
                                    <span className={classes.detailIcon} data-rough><PublicIcon name={'calendrier'} size={20}/></span>
                                    <div className={classes.detailText}>
                                        <span className={classes.detailPrimary}>{formatEventDates(event, i18n.locale)}</span>
                                        <span className={classes.detailSecondary} suppressHydrationWarning>
                                            {formatEventTimezone(event, i18n.locale)}
                                        </span>
                                    </div>
                                    <CalendarOptionsPopover event={event}>
                                        <button type="button" className={classes.detailLink}>
                                            {t`Add to Calendar`}
                                            <PublicIcon name={'fleche'} size={16}/>
                                        </button>
                                    </CalendarOptionsPopover>
                                </div>

                                {hasEnded && (
                                    <div className={classes.detail}>
                                        <span className={classes.detailIcon} data-rough><PublicIcon name={'horloge'} size={20}/></span>
                                        <div className={classes.detailText}>
                                            <span className={classes.detailPrimary}>{t`This event has ended`}</span>
                                        </div>
                                    </div>
                                )}

                                {isOnlineEvent && (
                                    <div className={classes.detail}>
                                        <span className={classes.detailIcon} data-rough><PublicIcon name={'globe'} size={20}/></span>
                                        <div className={classes.detailText}>
                                            <span className={classes.detailPrimary}>{t`Online Event`}</span>
                                            <span className={classes.detailSecondary}>{t`Join from anywhere`}</span>
                                        </div>
                                    </div>
                                )}

                                {hasLocation && locationDetails && (
                                    <div className={classes.detail}>
                                        <span className={classes.detailIcon} data-rough><PublicIcon name={'lieu'} size={20}/></span>
                                        <div className={classes.detailText}>
                                            <span className={classes.detailPrimary}>
                                                {locationDetails.venue_name || locationDetails.address_line_1 || locationDetails.city}
                                            </span>
                                            <span className={classes.detailSecondary}>{formatAddress(locationDetails)}</span>
                                        </div>
                                        {mapUrl && (
                                            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className={classes.detailLink}>
                                                {t`Get Directions`}
                                                <PublicIcon name={'fleche'} size={16}/>
                                            </a>
                                        )}
                                    </div>
                                )}
                            </section>

                            {event.description && (
                                <section className={`${classes.card} ${classes.section} ${classes.about}`} data-rough>
                                    <h2 className={classes.sectionTitle}>{t`About`}</h2>
                                    <CollapsibleDescription html={event.description}/>
                                </section>
                            )}

                            {hasLocation && locationDetails && mapUrl && (
                                <section className={`${classes.card} ${classes.section} ${classes.location}`} data-rough>
                                    <h2 className={classes.sectionTitle}>{t`Location`}</h2>
                                    <a
                                        href={mapUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={classes.map} data-rough
                                        aria-label={t`View on Google Maps`}
                                    >
                                        {/* Plan stylise (pas une vraie carte): des routes et le repere, aux couleurs de l'organisateur. */}
                                        <svg className={classes.mapRoads} viewBox="0 0 696 240" preserveAspectRatio="none" aria-hidden>
                                            <path d="M0 80L760 140M0 200L760 170M200 0L260 240M520 0L470 240" vectorEffect="non-scaling-stroke"/>
                                        </svg>
                                        <span className={classes.mapPin}>
                                            <PublicIcon name={'lieu'} size={24}/>
                                        </span>
                                    </a>
                                    <p className={classes.mapAddress}>{formatAddress(locationDetails)}</p>
                                </section>
                            )}

                            {organizerIsLive && (
                                <section className={`${classes.card} ${classes.organizer}`} data-rough id="organizer">
                                    <div className={classes.organizerMain}>
                                        <OrganizerLogo organizer={organizer} className={classes.organizerLogo}/>
                                        <div className={classes.organizerText}>
                                            <span className={classes.organizerLabel}>{t`Organized by`}</span>
                                            <Link to={organizerHomepagePath(organizer)} className={classes.organizerName}>
                                                {organizer.name}
                                            </Link>
                                            {organizerLocation && (
                                                <span className={classes.organizerLocation}>{organizerLocation}</span>
                                            )}
                                        </div>
                                        <button type="button" className={classes.outlineButton} data-rough="button" onClick={() => setContactModalOpen(true)}>
                                            <PublicIcon name={'courriel'} size={20}/>
                                            {t`Contact organizer`}
                                        </button>
                                    </div>

                                    {organizer.description && (
                                        <div
                                            className={classes.organizerBio}
                                            dangerouslySetInnerHTML={{__html: organizer.description}}
                                        />
                                    )}

                                    {hasOrganizerLinks && (
                                        <div className={classes.organizerLinks}>
                                            {socialLinks.map(({platform, url, Icon}) => (
                                                <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                                                   className={classes.organizerLink} data-rough="button" title={platform} aria-label={platform}>
                                                    <Icon size={18}/>
                                                </a>
                                            ))}
                                            {websiteHost && (
                                                <a href={organizer.website} target="_blank" rel="noopener noreferrer"
                                                   className={classes.organizerLink} data-rough="button" title={websiteHost} aria-label={websiteHost}>
                                                    <IconWorld size={18}/>
                                                </a>
                                            )}
                                            {organizer.donation_url && (
                                                <a href={organizer.donation_url} target="_blank" rel="noopener noreferrer"
                                                   className={classes.organizerLink} data-rough="button" title={t`Donate`} aria-label={t`Donate`}>
                                                    <IconHeart size={18}/>
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>

                        <TicketsCard
                            ref={ticketsRef}
                            className={classes.tickets}
                            event={event}
                            promoCodeValid={promoCodeValid}
                            promoCode={promoCode}
                            formId={TICKETS_FORM_ID}
                            onSelectionChange={setSelection}
                        />
                    </div>

                    <PublicPageFooter/>
                </div>

                <StickyBuyBar
                    event={event}
                    formId={TICKETS_FORM_ID}
                    selection={selection}
                    defaultTicket={defaultTicket}
                    ticketsOutOfView={ticketsOutOfView}
                    promoCode={promoCodeValid ? promoCode : null}
                    onSeeAllTickets={hasOtherProducts ? scrollToTickets : undefined}
                    onShowTickets={scrollToTickets}
                />

                {organizer && (
                    <ContactOrganizerModal
                        opened={contactModalOpen}
                        onClose={() => setContactModalOpen(false)}
                        organizer={organizer}
                    />
                )}

                {consentPending && (
                    <CookieConsentBanner onConsent={onConsent}/>
                )}
            </main>
        </>
    );
};

export default EventHomepage;
