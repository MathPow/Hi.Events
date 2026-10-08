import {useEffect} from "react";
import type {CSSProperties} from "react";
import {useParams} from "react-router";
import {t, Trans} from "@lingui/macro";
import {useClipboard} from "@mantine/hooks";
import QRCode from "react-qr-code";
import {Helmet} from "react-helmet-async";
import {
    IconAlertTriangle,
    IconCalendar,
    IconCheck,
    IconCopy,
    IconCurrencyDollar,
    IconReceipt,
    IconShare,
    IconTicket,
} from "@tabler/icons-react";
import homepageClasses from "../../layouts/EventHomepage/EventHomepage.module.scss";
import classes from "./AffiliatePartnerPage.module.scss";
import {useGetAffiliatePartnerPage} from "../../../queries/useGetAffiliatePartnerPage.ts";
import {useGetEventPublic} from "../../../queries/useGetEventPublic.ts";
import {affiliateShareUrl, eventCoverImage, imageUrl} from "../../../utilites/urlHelper.ts";
import {computeThemeVariables, validateThemeSettings} from "../../../utilites/themeUtils.ts";
import {ensureHomepageFontLoaded} from "../../../utilites/fontLoader.ts";
import {removeTransparency} from "../../../utilites/colorHelper.ts";
import {formatCurrency} from "../../../utilites/currency.ts";
import {AccentBlobs} from "../../common/AccentBlobs";
import {EventDateRange} from "../../common/EventDateRange";
import {PoweredByFooter} from "../../common/PoweredByFooter";
import {ShareComponent} from "../../common/ShareIcon";
import {LoadingMask} from "../../common/LoadingMask";
import {Event} from "../../../types.ts";

const themeStylesFor = (event?: Event) => {
    const themeSettings = validateThemeSettings(event?.settings?.homepage_theme_settings);
    const cssVars = computeThemeVariables(themeSettings);

    return {
        themeSettings,
        style: {
            '--event-bg-color': themeSettings.background,
            '--event-content-bg-color': cssVars['--theme-surface'],
            '--event-primary-color': themeSettings.accent,
            '--event-primary-text-color': cssVars['--theme-text-primary'],
            '--event-secondary-color': cssVars['--theme-text-secondary'],
            '--event-secondary-text-color': cssVars['--theme-text-tertiary'],
            '--event-accent-contrast': cssVars['--theme-accent-contrast'],
            '--event-accent-soft': cssVars['--theme-accent-soft'],
            '--event-accent-muted': cssVars['--theme-accent-muted'],
            '--event-border-color': cssVars['--theme-border'],
            '--theme-font-family': cssVars['--theme-font-family'],
            fontFamily: cssVars['--theme-font-family'],
        } as CSSProperties,
    };
};

const PartnerPageShell = ({event, children}: { event?: Event, children: React.ReactNode }) => {
    const {themeSettings, style} = themeStylesFor(event);
    const coverImage = event ? eventCoverImage(event)?.url : undefined;

    useEffect(() => {
        ensureHomepageFontLoaded(themeSettings.font_family);
    }, [themeSettings.font_family]);

    return (
        <main className={homepageClasses.pageWrapper} style={style} data-mode={themeSettings.mode}>
            <style>
                {`
                    body, .ssr-loader {
                        background-color: ${removeTransparency(themeSettings.background)} !important;
                    }
                `}
            </style>
            {(coverImage && themeSettings.background_type === 'MIRROR_COVER_IMAGE') ? (
                <div className={homepageClasses.background} style={{backgroundImage: `url(${coverImage})`}}/>
            ) : (
                <div className={homepageClasses.background} style={{backgroundColor: 'var(--event-bg-color)'}}/>
            )}
            <div
                className={homepageClasses.backgroundOverlay}
                style={themeSettings.background_type === 'MIRROR_COVER_IMAGE' ? {
                    '--overlay-color': themeSettings.background
                } as CSSProperties : undefined}
            />
            <AccentBlobs accentColor={themeSettings.accent} mode={themeSettings.mode}/>

            <div className={homepageClasses.container}>
                <div className={homepageClasses.wrapper}>
                    <div className={homepageClasses.mainCard}>
                        {children}
                    </div>
                    <div className={homepageClasses.footerSection}>
                        <PoweredByFooter className={homepageClasses.poweredByFooter}/>
                    </div>
                </div>
            </div>
        </main>
    );
};

const InvalidPartnerLink = () => (
    <PartnerPageShell>
        <div className={classes.emptyState}>
            <IconAlertTriangle size={40}/>
            <h1 className={homepageClasses.sectionTitle}>{t`This partner link is not valid`}</h1>
            <p>{t`It may have been revoked. Ask the organizer for a new link.`}</p>
        </div>
    </PartnerPageShell>
);

const StatTile = ({icon, label, value}: { icon: React.ReactNode, label: string, value: string | number }) => (
    <div className={classes.statTile}>
        <div className={classes.statIcon}>{icon}</div>
        <div className={classes.statValue}>{value}</div>
        <div className={classes.statLabel}>{label}</div>
    </div>
);

export const AffiliatePartnerPage = () => {
    const {token} = useParams();
    const clipboard = useClipboard({timeout: 2000});
    const {data: partner, isLoading: isPartnerLoading, isError: isPartnerError} = useGetAffiliatePartnerPage(token);
    const {data: event, isLoading: isEventLoading, isError: isEventError} = useGetEventPublic(
        partner?.event_id,
        !!partner?.event_id,
    );

    if (isPartnerLoading || (partner && isEventLoading)) {
        return <LoadingMask/>;
    }

    if (isPartnerError || isEventError || !partner || !event) {
        return <InvalidPartnerLink/>;
    }

    const coverImageData = eventCoverImage(event);
    const organizer = event.organizer;
    const organizerLogo = imageUrl('ORGANIZER_LOGO', organizer?.images);
    const shareUrl = affiliateShareUrl(event, partner.code, partner.promo_code);
    const isActive = partner.status === 'ACTIVE';

    return (
        <PartnerPageShell event={event}>
            <Helmet>
                <title>{t`Partner dashboard` + ` · ${event.title}`}</title>
                <meta name="robots" content="noindex, nofollow"/>
            </Helmet>

            <div className={homepageClasses.heroSection}>
                {coverImageData?.url && (
                    <div
                        className={`${homepageClasses.coverWrapper} ${classes.cover}`}
                        style={(coverImageData.width && coverImageData.height) ? {
                            '--cover-aspect-ratio': `${coverImageData.width} / ${coverImageData.height}`,
                        } as CSSProperties : undefined}
                    >
                        <img src={coverImageData.url} alt={event.title} className={homepageClasses.coverImage}/>
                    </div>
                )}

                <div className={homepageClasses.eventHeader}>
                    <div className={homepageClasses.headerTopRow}>
                        <div className={homepageClasses.organizerPill}>
                            {organizerLogo ? (
                                <img src={organizerLogo} alt={organizer?.name || ''} className={homepageClasses.organizerPillAvatar}/>
                            ) : (
                                <span className={homepageClasses.organizerPillAvatarPlaceholder}>
                                    {organizer?.name?.charAt(0).toUpperCase() || '?'}
                                </span>
                            )}
                            <span className={homepageClasses.organizerPillName}>{organizer?.name}</span>
                        </div>
                        <span className={classes.partnerBadge}>{t`Partner`}</span>
                    </div>

                    <h1 className={homepageClasses.eventTitle}>
                        <Trans>Thanks for spreading the word, {partner.name}!</Trans>
                    </h1>

                    <div className={homepageClasses.eventMeta}>
                        <div className={homepageClasses.metaItem}>
                            <div className={homepageClasses.metaIconBox}>
                                <IconCalendar/>
                            </div>
                            <div className={homepageClasses.metaContent}>
                                <div className={homepageClasses.metaPrimary}>{event.title}</div>
                                <div className={homepageClasses.metaSecondary}>
                                    <EventDateRange event={event}/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {!isActive && (
                <div className={classes.inactiveNotice}>
                    <IconAlertTriangle size={18}/>
                    {t`Your partner link is paused. New sales are not being counted for now.`}
                </div>
            )}

            <div className={homepageClasses.section}>
                <div className={homepageClasses.sectionHeader}>
                    <h2 className={homepageClasses.sectionTitle}>{t`Your results`}</h2>
                </div>
                <div className={classes.statsGrid}>
                    <StatTile icon={<IconTicket/>} label={t`Tickets sold`} value={partner.tickets_count}/>
                    <StatTile icon={<IconReceipt/>} label={t`Orders`} value={partner.orders_count}/>
                    <StatTile
                        icon={<IconCurrencyDollar/>}
                        label={t`Sales`}
                        value={formatCurrency(partner.total_gross, partner.currency)}
                    />
                </div>
                <p className={classes.hint}>
                    {partner.promo_code
                        ? t`Includes completed orders made through your link or with your promo code.`
                        : t`Includes completed orders made through your link.`}
                </p>
            </div>

            <div className={homepageClasses.section}>
                <div className={homepageClasses.sectionHeader}>
                    <h2 className={homepageClasses.sectionTitle}>{t`Your link`}</h2>
                </div>

                <div className={classes.shareLayout}>
                    <div className={classes.shareDetails}>
                        <div className={classes.linkBox}>
                            <span className={classes.linkText}>{shareUrl}</span>
                        </div>

                        <div className={classes.shareActions}>
                            <button className={classes.primaryButton} onClick={() => clipboard.copy(shareUrl)}>
                                {clipboard.copied ? <IconCheck size={18}/> : <IconCopy size={18}/>}
                                {clipboard.copied ? t`Copied` : t`Copy link`}
                            </button>
                            <ShareComponent
                                title={event.title}
                                text={event.title}
                                url={shareUrl}
                                imageUrl={coverImageData?.url}
                            >
                                <button className={classes.secondaryButton}>
                                    <IconShare size={18}/>
                                    {t`Share`}
                                </button>
                            </ShareComponent>
                        </div>

                        {partner.promo_code && (
                            <div className={classes.codeRow}>
                                <span className={classes.codeLabel}>{t`Promo code`}</span>
                                <span className={classes.codeValue}>{partner.promo_code.toUpperCase()}</span>
                                <span className={classes.codeHint}>
                                    {t`Applied automatically with your link. People can also type it at checkout.`}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className={classes.qrWrapper}>
                        <QRCode value={shareUrl} size={148}/>
                    </div>
                </div>
            </div>
        </PartnerPageShell>
    );
};

export default AffiliatePartnerPage;
