import {Link, useLocation, useNavigate} from "react-router";
import {Accordion} from '@mantine/core';
import {EventCard} from './EventCard';
import classes from './OrganizerHomepage.module.scss';
import React, {useEffect, useState} from 'react';
import {Event, GenericPaginatedResponse, Organizer} from "../../../types.ts";
import {OrganizerDocumentHead} from "../../common/OrganizerDocumentHead";
import {IconHeart} from '@tabler/icons-react';
import {t} from "@lingui/macro";
import {socialMediaConfig} from "../../../constants/socialMediaConfig";
import {ContactOrganizerModal} from "../../common/ContactOrganizerModal";
import {getGoogleMapsUrl, getShortLocationDisplay} from "../../../utilites/addressUtilities.ts";
import {organizerHomepagePath, organizerHomepageUrl} from "../../../utilites/urlHelper.ts";
import {StatusToggle} from "../../common/StatusToggle";
import {Pagination} from "../../common/Pagination";
import {computeThemeVariables, validateThemeSettings} from "../../../utilites/themeUtils.ts";
import {useOrganizerTrackingPixels} from "../../../hooks/useOrganizerTrackingPixels";
import {CookieConsentBanner} from "../../common/CookieConsentBanner";
import {PublicBarLink, PublicPageBar} from "../../common/PublicPageBar";
import {PublicPageFooter} from "../../common/PublicPageFooter";
import {PublicIcon} from "../../common/PublicIcon";
import {ShareComponent} from "../../common/ShareIcon";

interface OrganizerHomepageProps {
    organizer?: Organizer;
    eventsData?: GenericPaginatedResponse<Event>
    isPastEvents?: boolean;
    isPreview?: boolean;
}

const ScrollToTop = () => {
    const {pathname} = useLocation();

    useEffect(() => {
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 100);
    }, [pathname]);

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

    const {consentPending, onConsent} = useOrganizerTrackingPixels(
        organizer?.settings?.tracking_pixels
    );

    if (!organizer) {
        return null;
    }

    const homepagePath = organizerHomepagePath(organizer);
    const pastEventsPath = `${homepagePath}/past-events`;

    const socialHandles = organizer.settings?.social_media_handles ?? {};
    const instagramHandle = socialHandles.instagram?.trim().replace(/^@/, '');
    const otherSocialLinks = Object.entries(socialHandles)
        .filter(([platform, handle]) => platform !== 'instagram' && handle
            && socialMediaConfig[platform as keyof typeof socialMediaConfig])
        .map(([platform, handle]) => ({
            platform,
            url: socialMediaConfig[platform as keyof typeof socialMediaConfig].baseUrl + handle,
            Icon: socialMediaConfig[platform as keyof typeof socialMediaConfig].icon,
        }));

    const websiteUrl = organizer.website;
    const donationUrl = organizer.donation_url;
    const locationDetails = organizer.settings?.location_details;
    const shortLocation = getShortLocationDisplay(locationDetails);

    const organizerLogo = organizer.images?.find(img => img.type === 'ORGANIZER_LOGO');
    const organizerCover = organizer.images?.find(img => img.type === 'ORGANIZER_COVER');

    const events = eventsData?.data || [];
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
                    `}
                </style>

                <div className={classes.content}>
                    <div className={classes.bar}>
                        <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}/>
                    </div>

                    <header className={`${classes.card} ${classes.headerCard}`}>
                        <div className={classes.banner}>
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
                        </div>

                        <div className={classes.profile}>
                            <div className={classes.logo}>
                                {organizerLogo ? (
                                    <img src={organizerLogo.url} alt={organizer.name}/>
                                ) : (
                                    <span aria-hidden="true">{organizer.name.trim().charAt(0).toUpperCase()}</span>
                                )}
                            </div>

                            <div className={classes.infos}>
                                <h1 className={classes.name}>{organizer.name}</h1>

                                {organizer.description && (
                                    <div
                                        className={classes.description}
                                        dangerouslySetInnerHTML={{__html: organizer.description}}
                                    />
                                )}

                                {(shortLocation || websiteUrl || instagramHandle || otherSocialLinks.length > 0 || donationUrl) && (
                                    <ul className={classes.meta}>
                                        {shortLocation && locationDetails && (
                                            <li>
                                                <a href={getGoogleMapsUrl(locationDetails)} target="_blank"
                                                   rel="noopener noreferrer" className={classes.pill}>
                                                    <PublicIcon name={'lieu-petit'} className={classes.pillIcon}/>
                                                    {shortLocation}
                                                </a>
                                            </li>
                                        )}
                                        {websiteUrl && (
                                            <li>
                                                <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                                                   className={classes.pill}>
                                                    <PublicIcon name={'globe'} className={classes.pillIcon}/>
                                                    {websiteLabel(websiteUrl)}
                                                </a>
                                            </li>
                                        )}
                                        {instagramHandle && (
                                            <li>
                                                <a href={socialMediaConfig.instagram.baseUrl + instagramHandle}
                                                   target="_blank" rel="noopener noreferrer" className={classes.pill}>
                                                    <PublicIcon name={'instagram'} className={classes.pillIcon}/>
                                                    @{instagramHandle}
                                                </a>
                                            </li>
                                        )}
                                        {otherSocialLinks.map(({platform, url, Icon}) => (
                                            <li key={platform}>
                                                <a href={url} target="_blank" rel="noopener noreferrer"
                                                   className={`${classes.pill} ${classes.iconPill}`} aria-label={platform}>
                                                    <Icon size={16} stroke={1.8} className={classes.pillIcon}/>
                                                </a>
                                            </li>
                                        ))}
                                        {donationUrl && (
                                            <li>
                                                <a href={donationUrl} target="_blank" rel="noopener noreferrer"
                                                   className={classes.pill}>
                                                    <IconHeart size={16} stroke={1.8} className={classes.pillIcon}/>
                                                    {t`Donate`}
                                                </a>
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            <div className={classes.actions}>
                                <div className={classes.shareSlot}>
                                    <ShareComponent
                                        title={organizer.name}
                                        text={organizer.name}
                                        url={organizerHomepageUrl(organizer)}
                                    >
                                        <button type="button" className={`${classes.button} ${classes.buttonOutline}`}>
                                            <PublicIcon name={'partager'} size={20}/>
                                            {t`Share`}
                                        </button>
                                    </ShareComponent>
                                </div>
                                <button type="button" onClick={() => setContactModalOpen(true)}
                                        className={`${classes.button} ${classes.buttonFilled}`}>
                                    <PublicIcon name={'courriel'} size={20}/>
                                    {t`Contact organizer`}
                                </button>
                            </div>
                        </div>
                    </header>

                    <section className={`${classes.card} ${classes.section}`} aria-labelledby="organizer-events-title">
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
                                <Link to={homepagePath} className={classes.tab}
                                      aria-current={!isPastEvents ? 'page' : undefined}>
                                    {upcomingCount !== null ? (
                                        <>
                                            <span className={classes.longLabel}>{t`Upcoming (${upcomingCount})`}</span>
                                            <span className={classes.shortLabel}>{t`Upcoming`}</span>
                                        </>
                                    ) : t`Upcoming`}
                                </Link>
                                <Link to={pastEventsPath} className={classes.tab}
                                      aria-current={isPastEvents ? 'page' : undefined}>
                                    {t`Past`}
                                </Link>
                            </nav>
                        </div>

                        {events.length === 0 ? (
                            <div className={classes.empty}>
                                <PublicIcon name={'calendrier'} size={28} className={classes.pillIcon}/>
                                <p>{isPastEvents ? t`No past events` : t`No upcoming events`}</p>
                            </div>
                        ) : (
                            <div className={classes.grid}>
                                {events.map((event) => (
                                    <EventCard key={event.id} event={event as Event}/>
                                ))}
                            </div>
                        )}

                        {eventsData && eventsData.meta.total > eventsData.meta.per_page && (
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
                        <section className={`${classes.card} ${classes.section}`} aria-labelledby="organizer-faq-title">
                            <h2 id="organizer-faq-title" className={classes.sectionTitle}>
                                {t`Frequently asked questions`}
                            </h2>
                            <Accordion
                                multiple
                                chevronPosition="right"
                                classNames={{
                                    root: classes.faq,
                                    item: classes.faqItem,
                                    control: classes.faqControl,
                                    label: classes.faqQuestion,
                                    chevron: classes.faqChevron,
                                    content: classes.faqAnswer,
                                }}
                            >
                                {faqs.map((faq, index) => (
                                    <Accordion.Item key={index} value={String(index)}>
                                        <Accordion.Control>{faq.question}</Accordion.Control>
                                        <Accordion.Panel>{faq.answer}</Accordion.Panel>
                                    </Accordion.Item>
                                ))}
                            </Accordion>
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
