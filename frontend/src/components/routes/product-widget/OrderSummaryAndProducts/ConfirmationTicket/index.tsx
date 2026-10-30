import {t} from "@lingui/macro";
import QRCode from "react-qr-code";
import {IconX} from "@tabler/icons-react";
import {Attendee, Event, Product} from "../../../../../types.ts";
import {getAttendeeProductTitle} from "../../../../../utilites/products.ts";
import {getShortLocationDisplay} from "../../../../../utilites/addressUtilities.ts";
import {PublicIcon} from "../../../../common/PublicIcon";
import {shortDayLabel, shortTimeLabel} from "../confirmationDates.ts";
import {downloadQrCode} from "../../../../../utilites/download.ts";
import classes from "./ConfirmationTicket.module.scss";

// Le billet de la maquette: le haut couleur accent, la perforation, puis le code QR et le participant.
// Compact, c'est le « Prochain » de Mes billets sur telephone: pose dans une carte, le bas creme,
// le lieu avec la date, et le participant sur une ligne (nom a gauche, numero a droite).
export const ConfirmationTicket = ({attendee, event, compact = false}: {
    attendee: Attendee,
    event: Event,
    compact?: boolean,
}) => {
    const isCancelled = attendee.status === 'CANCELLED';
    const isAwaitingPayment = attendee.status === 'AWAITING_PAYMENT';
    const productTitle = getAttendeeProductTitle(attendee, attendee.product as Product);
    const place = compact ? getShortLocationDisplay(event.settings?.location_details) : null;

    return (
        <article className={compact ? `${classes.ticket} ${classes.compact}` : classes.ticket}>
            <div className={classes.top}>
                <div className={classes.topRow}>
                    <span className={classes.organizer}>{event.organizer?.name}</span>
                    {productTitle && !compact && (
                        <span className={classes.typePill} data-rough title={productTitle}>{productTitle}</span>
                    )}
                </div>
                <h3 className={classes.title}>{event.title}</h3>
                <div className={classes.infos}>
                    <span className={classes.info}>
                        <PublicIcon name={'calendrier'} size={18}/>
                        {shortDayLabel(event.start_date, event.timezone)}
                    </span>
                    <span className={classes.info}>
                        <PublicIcon name={'horloge'} size={18}/>
                        {shortTimeLabel(event.start_date, event.timezone)}
                    </span>
                    {place && (
                        <span className={classes.info}>
                            <PublicIcon name={'lieu-petit'} size={18}/>
                            {place}
                        </span>
                    )}
                </div>
            </div>

            <div className={classes.perforation} aria-hidden/>

            <div className={classes.bottom}>
                {(isCancelled || isAwaitingPayment) ? (
                    <div className={classes.qrPlaceholder} data-rough>
                        <span className={classes.qrPlaceholderIcon}>
                            {isCancelled ? <IconX size={20} stroke={2}/> : <PublicIcon name={'cadenas'} size={20}/>}
                        </span>
                        <span>{isCancelled ? t`Cancelled` : t`Pay to unlock`}</span>
                    </div>
                ) : (
                    <>
                        {/* Touche ou clic: le code enregistre en image (downloadQrCode). */}
                        <button type="button" className={classes.qr} data-rough title={t`Download the QR code`}
                                aria-label={t`Download the QR code`}
                                onClick={(clickEvent) => {
                                    const svg = clickEvent.currentTarget.querySelector('svg');
                                    svg && downloadQrCode(svg, `qr-${attendee.public_id}.png`);
                                }}>
                            <QRCode
                                value={String(attendee.public_id)}
                                size={180}
                                level="M"
                                fgColor="currentColor"
                                bgColor="transparent"
                            />
                        </button>
                        <p className={classes.hint}>
                            {compact ? t`Show this code at the entrance · max brightness` : t`Show this code at the entrance`}
                        </p>
                    </>
                )}

                <div className={classes.attendee} data-rough>
                    <div className={classes.attendeeName}>
                        <span className={classes.label}>{t`Participant`}</span>
                        <span className={classes.value}>{attendee.first_name} {attendee.last_name}</span>
                    </div>
                    {!!attendee.bib_number && (
                        <div className={classes.attendeeNumber}>
                            <span className={classes.label}>{t`Bib`}</span>
                            <span className={classes.value}>{attendee.bib_number}</span>
                        </div>
                    )}
                    <div className={classes.attendeeNumber}>
                        <span className={classes.label}>{t`Ticket`}</span>
                        <a
                            className={classes.value}
                            href={`/product/${event.id}/${attendee.short_id}`}
                            target="_blank"
                            rel="noreferrer"
                            title={t`View Ticket`}
                        >
                            {attendee.public_id}
                        </a>
                    </div>
                </div>
            </div>
        </article>
    );
};
