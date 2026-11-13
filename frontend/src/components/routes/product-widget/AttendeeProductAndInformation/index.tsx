import {useGetEventPublic} from "../../../../queries/useGetEventPublic.ts";
import {useParams} from "react-router";
import {useGetAttendeePublic} from "../../../../queries/useGetAttendeePublic.ts";
import {AttendeeTicket} from "../../../common/AttendeeTicket";
import {Attendee, Product} from "../../../../types.ts";
import {t} from "@lingui/macro";
import {CSSProperties, useState} from "react";
import {OnlineEventDetails} from "../../../common/OnlineEventDetails";
import {HomepageInfoMessage} from "../../../common/HomepageInfoMessage";
import {PublicBarLink, PublicPageBar} from "../../../common/PublicPageBar";
import {PublicPageFooter} from "../../../common/PublicPageFooter";
import {computeThemeVariables, publicHighlightCss, validateThemeSettings} from "../../../../utilites/themeUtils.ts";
import print from "../PrintOrder/PrintOrder.module.scss";
import shell from "../../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import classes from './AttendeeProductAndInformation.module.scss';
import {useGetParticipantSignatures} from "../../../../queries/useGetParticipantSignatures.ts";
import {hasPendingSignatures, participantSignatureClientPublic} from "../../../../api/participantSignature.client.ts";
import {ParticipantSigning} from "../../../common/ParticipantSigning";
import {showSuccess} from "../../../../utilites/notifications.tsx";
import {RouteDownloads} from "./RouteDownloads.tsx";
import {useGetTicketTransfer} from "../../../../queries/useGetTicketTransfer.ts";
import {transferDeadlineLabel, TransferTicketModal} from "../../../modals/TransferTicketModal";
import {useGetTransferredHolderDetails} from "../../../../queries/useGetTransferredHolderDetails.ts";
import {HolderDetailsCard} from "./HolderDetailsCard.tsx";

/**
 * A ticket's page (/product/<event>/<ticket>): the cream public page of the order confirmation and
 * of the printed tickets (PrintTickets).
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
    // Ce que le participant a encore a signer lui-meme (le lien « Signer maintenant » de son courriel).
    const signaturesQuery = useGetParticipantSignatures(eventId, String(attendeeShortId));
    const transferQuery = useGetTicketTransfer(eventId, String(attendeeShortId));
    // A transferred ticket's new holder gives their own participant details first.
    const detailsQuery = useGetTransferredHolderDetails(eventId, String(attendeeShortId));
    const [transferOpened, setTransferOpened] = useState(false);
    const [transferredTo, setTransferredTo] = useState<string | null>(null);

    // The old link stops working once the ticket is given away.
    if (transferredTo) {
        return (
            <HomepageInfoMessage
                status="success"
                message={t`Ticket transferred`}
                subtitle={t`${transferredTo} receives the ticket by email. This link no longer works.`}
            />
        );
    }

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

    const transfer = transferQuery.data;
    const timezone = event.timezone || 'UTC';
    const transferDeadline = transfer?.deadline ? transferDeadlineLabel(transfer.deadline, timezone) : null;
    const showTransfer = !!transfer?.enabled && (transfer.can_transfer || transfer.refusal === 'DEADLINE_PASSED');
    const pendingDetails = detailsQuery.data ?? [];

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

            {pendingDetails.length > 0 && (
                <HolderDetailsCard
                    eventId={eventId!}
                    attendeeShortId={String(attendeeShortId)}
                    questions={pendingDetails}
                    onSaved={() => Promise.all([detailsQuery.refetch(), signaturesQuery.refetch()])}
                />
            )}

            {pendingDetails.length === 0 && hasPendingSignatures(signaturesQuery.data) && (
                <section id="signer" className={`${classes.signCard} ${print.screenOnly}`} data-rough>
                    <h2 className={classes.signTitle}>{t`To sign before the event`}</h2>
                    <p className={classes.signIntro}>
                        {t`Read and sign below. Without it, you sign at the entrance before being let in.`}
                    </p>
                    <ParticipantSigning
                        pending={signaturesQuery.data!}
                        submitLabel={t`Sign`}
                        onSign={async (input) => {
                            await participantSignatureClientPublic.signForTicket(eventId!, String(attendeeShortId), input);
                            showSuccess(t`Thank you, it's signed. See you at the event!`);
                            await signaturesQuery.refetch();
                        }}
                    />
                </section>
            )}

            <div className={classes.ticket}>
                <AttendeeTicket
                    attendee={attendee as Attendee}
                    product={attendee.product as Product}
                    event={event}
                    showPoweredBy
                />
                <RouteDownloads eventId={eventId}/>
                {showTransfer && (
                    <section className={`${classes.transferCard} ${print.screenOnly}`} data-rough>
                        <div>
                            <h2 className={classes.transferTitle}>{t`Can't make it?`}</h2>
                            <p className={classes.transferText}>
                                {transfer!.can_transfer
                                    ? (transferDeadline
                                        ? t`Give your ticket to someone else, until ${transferDeadline}.`
                                        : t`Give your ticket to someone else.`)
                                    : transfer!.refusal_message}
                            </p>
                        </div>
                        {transfer!.can_transfer && (
                            <button type="button" className={`${shell.button} ${shell.buttonFilled} ${classes.transferButton}`}
                                    onClick={() => setTransferOpened(true)}>
                                {t`Transfer my ticket`}
                            </button>
                        )}
                    </section>
                )}
                {event?.settings?.is_online_event && <OnlineEventDetails eventSettings={event.settings}/>}
            </div>

            {transferOpened && (
                <TransferTicketModal
                    eventId={eventId!}
                    timezone={timezone}
                    attendee={attendee as Attendee}
                    onClose={() => setTransferOpened(false)}
                    onTransferred={(name) => {
                        setTransferOpened(false);
                        setTransferredTo(name);
                    }}
                />
            )}

            <div className={print.screenOnly}>
                <PublicPageFooter/>
            </div>
        </main>
    );
}

export default AttendeeProductAndInformation;
