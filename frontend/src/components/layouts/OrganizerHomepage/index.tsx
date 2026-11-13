import {Link, useLocation, useNavigate} from "react-router";
import {EventCard} from './EventCard';
import classes from './OrganizerHomepage.module.scss';
import React, {useEffect, useRef, useState} from 'react';
import {Event, GenericPaginatedResponse, Organizer} from "../../../types.ts";
import {OrganizerDocumentHead} from "../../common/OrganizerDocumentHead";
import {IconHeart} from '@tabler/icons-react';
import {t} from "@lingui/macro";
import {socialMediaConfig} from "../../../constants/socialMediaConfig";
import {CollapsibleDescription} from "../EventHomepage/CollapsibleDescription";
import {ContactOrganizerModal} from "../../common/ContactOrganizerModal";
import {getGoogleMapsUrl, getShortLocationDisplay} from "../../../utilites/addressUtilities.ts";
import {organizerHomepagePath, organizerHomepageUrl} from "../../../utilites/urlHelper.ts";
import {StatusToggle} from "../../common/StatusToggle";
import {Pagination} from "../../common/Pagination";
import {computeThemeVariables, publicHighlightCss, validateThemeSettings} from "../../../utilites/themeUtils.ts";
import {useOrganizerTrackingPixels} from "../../../hooks/useOrganizerTrackingPixels";
import {CookieConsentBanner} from "../../common/CookieConsentBanner";
import {PublicBarLink, PublicPageBar} from "../../common/PublicPageBar";
import {PublicPageFooter} from "../../common/PublicPageFooter";
import {PublicIcon} from "../../common/PublicIcon";
import {FaqAccordion} from "../../common/FaqAccordion";
import {ShareComponent} from "../../common/ShareIcon";
import {visibleSocialHandles} from "../../../utilites/socialLinks.ts";
import {AchievementStack} from "./AchievementStack";

interface OrganizerHomepageProps {
    organizer?: Organizer;
    eventsData?: GenericPaginatedResponse<Event>
    isPastEvents?: boolean;
    isPreview?: boolean;
}

// En arrivant sur la page, on part du haut. Pas en passant d'« A venir » a « Passes »: l'adresse
// change, mais on reste ou on etait dans la page (TAB_STATE).
const TAB_STATE = {keepScroll: true};
const FIRST_EVENTS = 9;

const ScrollToTop = () => {
    const {pathname, state} = useLocation();
    const keepScroll = (state as typeof TAB_STATE | null)?.keepScroll === true;

    useEffect(() => {
        if (keepScroll) {
            return;
        }
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 100);
    }, [pathname, keepScroll]);

    return null;
}

const websiteLabel = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
};

export const OrganizerHomepage = ({
                                      organizer,
                                      eventsData,
                                      isPastEvents = false,
                                  }: OrganizerHomepageProps) => {
    const navigate = useNavigate();
    const [contactModalOpen, setContactModalOpen] = useState(false);
    const [showAllEvents, setShowAllEvents] = useState(false);
    const eventsGrid = useRef<HTMLDivElement>(null);
    useEffect(() => setShowAllEvents(false), [isPastEvents]);

    const {consentPending, onConsent} = useOrganizerTrackingPixels(
        organizer?.settings?.tracking_pixels
    );

    if (!organizer) {
        return null;
    }

    const homepagePath = organizerHomepagePath(organizer);
    const pastEventsPath = `${homepagePath}/past-events`;

    // In the order chosen on « Ma page »: Instagram shows its @handle, the others their icon.
    const socialLinks = visibleSocialHandles(organizer.settings?.social_media_handles, organizer.settings?.social_media_layout)
        .filter(({platform}) => socialMediaConfig[platform as keyof typeof socialMediaConfig])
        .map(({platform, handle}) => {
            const config = socialMediaConfig[platform as keyof typeof socialMediaConfig];
            const cleanHandle = handle.trim().replace(/^@/, '');
            return {platform, handle: cleanHandle, url: config.baseUrl + cleanHandle, Icon: config.icon};
        });

    const websiteUrl = organizer.website;
    const donationUrl = organizer.donation_url;
    const locationDetails = organizer.settings?.location_details;
    const shortLocation = getShortLocationDisplay(locationDetails);

    const organizerLogo = organizer.images?.find(img => img.type === 'ORGANIZER_LOGO');
    const organizerCover = organizer.images?.find(img => img.type === 'ORGANIZER_COVER');

    const events = eventsData?.data || [];
    // Trois rangees d'abord; « Voir tous les evenements » montre le reste, puis la pagination.
    const allEventsShown = showAllEvents || (eventsData?.meta.current_page ?? 1) > 1;
    const shownEvents = allEventsShown ? events : events.slice(0, FIRST_EVENTS);
    const showAll = () => {
        setShowAllEvents(true);
        requestAnimationFrame(() => eventsGrid.current?.querySelectorAll('a')[FIRST_EVENTS]?.focus({preventScroll: true}));
    };
    const faqs = organizer.settings?.faqs ?? [];
    const upcomingCount = !isPastEvents && eventsData ? eventsData.meta.total : null;

    // Seule la couleur principale de l'organisateur suit son theme (le creme, le texte fonce, la
    // police et le fond restent ceux de Dehors). Sans theme enregistre, on garde l'orange Dehors.
    const rawThemeSettings = organizer.settings?.homepage_theme_settings;
    const themeStyles = (rawThemeSettings?.accent
        ? Object.fromEntries(Object.entries(computeThemeVariables(validateThemeSettings(rawThemeSettings)))
            .filter(([name]) => name.startsWith('--theme-accent')))
        : {}) as React.CSSProperties;

    return (
        <>
            <ScrollToTop/>
            {organizer?.status && organizer?.id && (
                <StatusToggle
                    entityType="organizer"
                    entityId={organizer.id}
                    currentStatus={organizer.status as 'DRAFT' | 'LIVE'}
                    entityName={organizer.name}
                    onSuccess={() =>
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000)}
                />
            )}

            {organizer && <OrganizerDocumentHead organizer={organizer}/>}
            <main className={classes.page} style={themeStyles}>
                <style>
                    {`
                        body, .ssr-loader {
                            background-color: var(--dehors-creme) !important;
                        }
                        ${publicHighlightCss(rawThemeSettings?.accent)}
                    `}
                </style>

                <div className={classes.halo} aria-hidden/>

                <div className={classes.content}>
                    <div className={classes.bar}>
                        <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}/>
                    </div>

                    <header className={`${classes.card} ${classes.headerCard}`} data-rough>
                        <div className={classes.banner} data-rough>
                            {organizerCover ? (
                                <>
                                    {organizerCover.lqip_base64 && (
                                        <img src={organizerCover.lqip_base64} alt="" aria-hidden="true"
                                             className={classes.bannerImage}/>
                                    )}
                                    <img src={organizerCover.url} alt="" className={classes.bannerImage}/>
                                </>
                            ) : (
                                <span className={classes.bannerName} aria-hidden="true">{organizer.name}</span>
                            )}
                            {!!organizer.achievements?.length && <AchievementStack achievements={organizer.achievements}/>}
                        </div>

                        <div className={classes.profile}>
                            <div className={classes.logo} data-rough>
                                {organizerLogo ? (
                                    <img src={organizerLogo.url} alt={organizer.name}/>
                                ) : (
                                    <span aria-hidden="true">{organizer.name.trim().charAt(0).toUpperCase()}</span>
                                )}
                            </div>

                            <div className={classes.infos}>
                                {/* Deux lignes au plus; le nom entier au survol. */}
                                <h1 className={classes.name} title={organizer.name}>{organizer.name}</h1>

                                {/* Trois lignes au plus, « Lire la suite » pour le reste. */}
                                {organizer.description && (
                                    <div className={classes.descriptionBlock}>
                                        <CollapsibleDescription html={organizer.description}
                                                                className={classes.description} compact/>
                                    </div>
                                )}

                                {(shortLocation || websiteUrl || socialLinks.length > 0 || donationUrl) && (
                                    <div className={classes.meta}>
                                        {shortLocation && locationDetails && (
                                            <a href={getGoogleMapsUrl(locationDetails)} target="_blank"
                                               rel="noopener noreferrer" className={classes.metaLink}>
                                                <PublicIcon name={'lieu-petit'} className={classes.metaIcon}/>
                                                {shortLocation}
                                            </a>
                                        )}
                                        {websiteUrl && (
                                            <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                                               className={classes.metaLink}>
                                                <PublicIcon name={'globe'} className={classes.metaIcon}/>
                                                {/* Sur telephone, « Site web ↗ »: la ligne d'infos tient sans couper le domaine. */}
                                                <span className={classes.longLabel}>{websiteLabel(websiteUrl)}</span>
                                                <span className={classes.shortLabel}>{t`Website`} ↗</span>
                                            </a>
                                        )}
                                        {donationUrl && (
                                            <a href={donationUrl} target="_blank" rel="noopener noreferrer"
                                               className={classes.metaLink}>
                                                <IconHeart size={16} stroke={1.8} className={classes.metaIcon}/>
                                                {t`Donate`}
                                            </a>
                                        )}
                                        {socialLinks.length > 0 && (
                                            <ul className={classes.socials}>
                                                {socialLinks.map(({platform, handle, url, Icon}) => (
                                                    <li key={platform}>
                                                        <a href={url} target="_blank" rel="noopener noreferrer"
                                                           className={classes.social}
                                                           aria-label={`${platform} @${handle}`} title={`@${handle}`}>
                                                            {platform === 'instagram'
                                                                ? <PublicIcon name={'instagram'} size={18}/>
                                                                : <Icon size={18} stroke={1.8}/>}
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className={classes.actions}>
                                <div className={classes.shareSlot}>
                                    <ShareComponent
                                        title={organizer.name}
                                        text={organizer.name}
                                        url={organizerHomepageUrl(organizer)}
                                    >
                                        {/* Sur telephone, l'icone seule: Contacter prend la largeur. */}
                                        <button type="button" className={`${classes.button} ${classes.buttonOutline} ${classes.shareButton}`}
                                                data-rough="button" aria-label={t`Share`}>
                                            <PublicIcon name={'partager'} size={20}/>
                                            <span className={classes.longLabel}>{t`Share`}</span>
                                        </button>
                                    </ShareComponent>
                                </div>
                                <button type="button" onClick={() => setContactModalOpen(true)}
                                        className={`${classes.button} ${classes.buttonFilled}`} data-rough="button">
                                    <PublicIcon name={'courriel'} size={20}/>
                                    {t`Contact organizer`}
                                </button>
                            </div>
                        </div>
                    </header>

                    <section className={`${classes.card} ${classes.section}`} data-rough aria-labelledby="organizer-events-title">
                        <div className={classes.sectionHeader}>
                            <h2 id="organizer-events-title" className={classes.sectionTitle}>
                                <span className={classes.longLabel}>
                                    {isPastEvents ? t`Past Events` : t`Upcoming Events`}
                                </span>
                                <span className={classes.shortLabel}>
                                    {isPastEvents ? t`Past` : t`Upcoming`}
                                </span>
                            </h2>
                            <nav className={classes.tabs}>
                                <Link to={homepagePath} state={TAB_STATE} className={classes.tab} data-rough
                                      aria-current={!isPastEvents ? 'page' : undefined}>
                                    {upcomingCount !== null ? (
                                        <>
                                            <span className={classes.longLabel}>{t`Upcoming (${upcomingCount})`}</span>
                                            <span className={classes.shortLabel}>{t`Upcoming`}</span>
                                        </>
                                    ) : t`Upcoming`}
                                </Link>
                                <Link to={pastEventsPath} state={TAB_STATE} className={classes.tab} data-rough
                                      aria-current={isPastEvents ? 'page' : undefined}>
                                    {t`Past`}
                                </Link>
                            </nav>
                        </div>

                        {events.length === 0 ? (
                            <div className={classes.empty} data-rough>
                                <PublicIcon name={'calendrier'} size={28} className={classes.pillIcon}/>
                                <p>{isPastEvents ? t`No past events` : t`No upcoming events`}</p>
                            </div>
                        ) : (
                            <div ref={eventsGrid} className={classes.grid}>
                                {shownEvents.map((event) => (
                                    <EventCard key={event.id} event={event as Event}/>
                                ))}
                            </div>
                        )}

                        {shownEvents.length < events.length && (
                            <button type="button" onClick={showAll} data-rough="button"
                                    className={`${classes.button} ${classes.buttonOutline} ${classes.seeAllEvents}`}>
                                {t`See all events`}
                                <PublicIcon name={'chevron'} size={20}/>
                            </button>
                        )}

                        {allEventsShown && eventsData && eventsData.meta.total > eventsData.meta.per_page && (
                            <Pagination
                                size="sm"
                                siblings={1}
                                marginTop={0}
                                total={eventsData.meta.last_page}
                                value={eventsData.meta.current_page}
                                onChange={(page) => navigate(`${isPastEvents ? pastEventsPath : homepagePath}?page=${page}`)}
                                className={classes.pagination}
                            />
                        )}
                    </section>

                    {faqs.length > 0 && (
                        <section className={`${classes.card} ${classes.section}`} data-rough aria-labelledby="organizer-faq-title">
                            <h2 id="organizer-faq-title" className={classes.sectionTitle}>
                                {t`Frequently asked questions`}
                            </h2>
                            <FaqAccordion faqs={faqs}/>
                        </section>
                    )}

                    <PublicPageFooter/>
                </div>

                <ContactOrganizerModal
                    opened={contactModalOpen}
                    onClose={() => setContactModalOpen(false)}
                    organizer={organizer}
                />
                {consentPending && (
                    <CookieConsentBanner onConsent={onConsent}/>
                )}
            </main>
        </>
    );
};

export default OrganizerHomepage;
