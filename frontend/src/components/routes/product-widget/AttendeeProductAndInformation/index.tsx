import {useGetEventPublic} from "../../../../queries/useGetEventPublic.ts";
import {useParams} from "react-router";
import {useGetAttendeePublic} from "../../../../queries/useGetAttendeePublic.ts";
import {AttendeeTicket} from "../../../common/AttendeeTicket";
import {Attendee, Product} from "../../../../types.ts";
import {t} from "@lingui/macro";
import {CSSProperties} from "react";
import {OnlineEventDetails} from "../../../common/OnlineEventDetails";
import {HomepageInfoMessage} from "../../../common/HomepageInfoMessage";
import {PublicBarLink, PublicPageBar} from "../../../common/PublicPageBar";
import {PublicPageFooter} from "../../../common/PublicPageFooter";
import {computeThemeVariables, publicHighlightCss, validateThemeSettings} from "../../../../utilites/themeUtils.ts";
import print from "../PrintOrder/PrintOrder.module.scss";
import classes from './AttendeeProductAndInformation.module.scss';

/**
 * A ticket's page (/product/<event>/<ticket>): the cream public page of the order confirmation and
 * of the printed tickets (PrintTickets), the ticket as the ticket designer shows it.
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
export const AttendeeProductAndInformation = () => {
    const {eventId, attendeeShortId} = useParams();
    const {data: event, isError: eventError} = useGetEventPublic(eventId);
    const {data: attendee, isError: attendeeError} = useGetAttendeePublic(eventId, String(attendeeShortId));

    if (eventError || attendeeError) {
        return (
            <HomepageInfoMessage
                status="not_found"
                message={t`Ticket Not Found`}
                subtitle={t`We couldn't find the ticket you're looking for. The link may have expired or the ticket details may have changed.`}
            />
        );
    }

    if (!event || !attendee) {
        return null;
    }

    // Like the confirmation: only the main color follows the event's theme.
    const rawThemeSettings = event.settings?.homepage_theme_settings;
    const themeStyles = (rawThemeSettings?.accent
        ? Object.fromEntries(Object.entries(computeThemeVariables({...validateThemeSettings(rawThemeSettings), mode: 'light'}))
            .filter(([name]) => name.startsWith('--theme-accent')))
        : {}) as CSSProperties;

    return (
        <main className={print.page} style={themeStyles}>
            <style>
                {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                {`
                    body, .ssr-loader {
                        background-color: var(--dehors-creme) !important;
                    }
                    ${publicHighlightCss(rawThemeSettings?.accent)}
                `}
            </style>

            <div className={print.screenOnly}>
                {/* eslint-disable-next-line lingui/no-unlocalized-strings */}
                <PublicPageBar left={<PublicBarLink to={'/'}>Billetterie Dehors</PublicBarLink>}/>
            </div>

            <header className={`${print.hero} ${print.screenOnly}`} data-rough>
                <p className={print.kicker}>{t`See you outside!`}</p>
                <h1 className={print.heroTitle}>{t`Your ticket`}</h1>
                <p className={print.heroLine}>{event.title}</p>
            </header>

            <div className={classes.ticket}>
                <AttendeeTicket
                    attendee={attendee as Attendee}
                    product={attendee.product as Product}
                    event={event}
                    showPoweredBy
                />
                {event?.settings?.is_online_event && <OnlineEventDetails eventSettings={event.settings}/>}
            </div>

            <div className={print.screenOnly}>
                <PublicPageFooter/>
            </div>
        </main>
    );
}

export default AttendeeProductAndInformation;
