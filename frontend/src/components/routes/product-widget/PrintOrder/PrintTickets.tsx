import {t} from "@lingui/macro";
import {CSSProperties, useEffect} from "react";
import {UnstyledButton} from "@mantine/core";
import {Attendee, Event} from "../../../../types.ts";
import {computeThemeVariables, publicHighlightCss, validateThemeSettings} from "../../../../utilites/themeUtils.ts";
import {eventLocation} from "../../../../utilites/addressUtilities.ts";
import {ConfirmationTicket} from "../OrderSummaryAndProducts/ConfirmationTicket";
import {eventRangeLabel, timezoneLabel} from "../OrderSummaryAndProducts/confirmationDates.ts";
import {PublicIcon, PublicIconName} from "../../../common/PublicIcon";
import {PublicBarLink, PublicPageBar} from "../../../common/PublicPageBar";
import {PublicPageFooter} from "../../../common/PublicPageFooter";
import {PoweredByFooter} from "../../../common/PoweredByFooter";
import classes from './PrintOrder.module.scss';

const Detail = ({icon, title, subtitle}: { icon: PublicIconName, title: string, subtitle?: string | null }) => (
    <div className={classes.detail}>
        <span className={classes.detailIcon} data-rough><PublicIcon name={icon} size={20}/></span>
        <span className={classes.detailText}>
            <span className={classes.detailTitle}>{title}</span>
            {subtitle && <span className={classes.detailSubtitle}>{subtitle}</span>}
        </span>
    </div>
);

// Ce que le billet ne dit pas: la date complete, l'adresse, la note de l'organisateur (Personnalisation
// de billets) et son logo, les acces d'un evenement en ligne.
const EventDetails = ({event}: { event: Event }) => {
    const location = eventLocation(event);
    const footerText = event.settings?.ticket_design_settings?.footer_text;
    const logo = event.images?.find((image) => image.type === 'TICKET_LOGO')?.url;
    const online = event.settings?.is_online_event;

    return (
        <section className={classes.details} data-rough>
            <div className={classes.detailsHeader}>
                <h2 className={classes.detailsTitle}>{t`The event`}</h2>
                {logo && <img className={classes.logo} src={logo} alt=""/>}
            </div>
            <Detail icon={'calendrier'}
                    title={eventRangeLabel(event.start_date, event.end_date, event.timezone)}
                    subtitle={timezoneLabel(event.start_date, event.timezone)}/>
            {location && <Detail icon={'lieu'} title={location.title} subtitle={location.subtitle}/>}
            {online && <Detail icon={'globe'} title={t`Online Event`}/>}
            {online && !!event.settings?.online_event_connection_details && (
                <div className={classes.richText}
                     dangerouslySetInnerHTML={{__html: event.settings.online_event_connection_details}}/>
            )}
            {!!footerText && <p className={classes.note}>{footerText}</p>}
        </section>
    );
};

/**
 * Les billets a imprimer (une commande, ou un seul billet): a l'ecran, la page creme de la confirmation
 * et un bouton « Imprimer »; sur papier, une page par billet, le billet de la maquette et l'evenement.
 *
 * (c) Hi.Events Ltd 2025
 *
 * PLEASE NOTE:
 *
 * Hi.Events is licensed under the GNU Affero General Public License (AGPL) version 3.
 *
 * You can find the full license text at: https://github.com/HiEventsDev/hi.events/blob/main/LICENCE
 *
 * In accordance with Section 7(b) of the AGPL, we ask that you retain the "Powered by Hi.Events" notice.
 *
 * If you wish to remove this notice, a commercial license is available at: https://hi.events/licensing
 */
export const PrintTickets = ({event, attendees, orderPublicId}: {
    event: Event,
    attendees: Attendee[],
    orderPublicId?: string,
}) => {
    // La fenetre d'impression s'ouvre seule, une fois les polices chargees (sinon le titre du billet
    // sortirait dans la police de secours).
    useEffect(() => {
        let cancelled = false;
        const fontsReady = document.fonts?.ready ?? Promise.resolve();
        fontsReady.then(() => setTimeout(() => !cancelled && window.print(), 300));

        return () => {
            cancelled = true;
        };
    }, []);

    // Comme la confirmation: seule la couleur principale suit le theme de l'evenement.
    const rawThemeSettings = event.settings?.homepage_theme_settings;
    const themeStyles = (rawThemeSettings?.accent
        ? Object.fromEntries(Object.entries(computeThemeVariables({...validateThemeSettings(rawThemeSettings), mode: 'light'}))
            .filter(([name]) => name.startsWith('--theme-accent')))
        : {}) as CSSProperties;

    return (
        <div className={classes.page} style={themeStyles}>
            <style>
                {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                {`
                    body, .ssr-loader {
                        background-color: var(--dehors-creme) !important;
                    }
                    @media print {
                        body, .ssr-loader {
                            background-color: #fff !important;
                        }
                    }
                    ${publicHighlightCss(rawThemeSettings?.accent)}
                `}
            </style>

            <div className={classes.screenOnly}>
                {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}/>
            </div>

            <header className={`${classes.hero} ${classes.screenOnly}`} data-rough>
                <p className={classes.kicker}>{t`See you outside!`}</p>
                <h1 className={classes.heroTitle}>{attendees.length > 1 ? t`Your tickets` : t`Your ticket`}</h1>
                <p className={classes.heroLine}>
                    <span>{event.title}</span>
                    {orderPublicId && <span className={classes.afterDot}>{t`Order`} {orderPublicId}</span>}
                </p>
                <UnstyledButton className={classes.printButton} data-rough="button" onClick={() => window.print()}>
                    <PublicIcon name={'imprimer'} size={20}/>
                    {t`Print`}
                </UnstyledButton>
            </header>

            {/* A l'ecran, les billets a gauche et l'evenement une seule fois a droite; sur papier, chaque
                page reprend l'evenement a cote de son billet. */}
            <div className={classes.columns}>
                <div className={classes.sheets}>
                    {attendees.map((attendee) => (
                        <section key={attendee.id} className={classes.sheet}>
                            <div className={classes.sheetHead}>
                                {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                                <span className={classes.brand}>Billetterie Dehors</span>
                                {orderPublicId && <span>{t`Order`} {orderPublicId}</span>}
                            </div>
                            <div className={classes.sheetBody}>
                                <div className={classes.ticket}>
                                    <ConfirmationTicket attendee={attendee} event={event}/>
                                </div>
                                <div className={classes.printOnly}>
                                    <EventDetails event={event}/>
                                </div>
                            </div>
                            <PoweredByFooter className={classes.sheetFoot}/>
                        </section>
                    ))}
                </div>
                <div className={`${classes.aside} ${classes.screenOnly}`}>
                    <EventDetails event={event}/>
                </div>
            </div>

            <div className={classes.screenOnly}>
                <PublicPageFooter/>
            </div>
        </div>
    );
};
