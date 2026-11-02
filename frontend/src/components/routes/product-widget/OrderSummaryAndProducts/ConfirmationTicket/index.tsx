import {t} from "@lingui/macro";
import {CSSProperties, useEffect, useRef, useState} from "react";
import QRCode from "react-qr-code";
import {IconX} from "@tabler/icons-react";
import {Attendee, Event, Product} from "../../../../../types.ts";
import {getAttendeeProductTitle} from "../../../../../utilites/products.ts";
import {getShortLocationDisplay} from "../../../../../utilites/addressUtilities.ts";
import {PublicIcon} from "../../../../common/PublicIcon";
import {shortDayLabel, shortTimeLabel} from "../confirmationDates.ts";
import {canSaveImageToPhotos, downloadQrCode, qrCodePng, shareImage} from "../../../../../utilites/download.ts";
import {isLightColor, toHexColor} from "../../../../../utilites/themeUtils.ts";
import {EventDateRange} from "../../../../common/EventDateRange";
import classes from "./ConfirmationTicket.module.scss";

// Ce que montre en plus le billet seul (AttendeeTicket: page du billet, apercu du concepteur de
// billets, fiche du participant): les reglages du concepteur (couleur, logo, date, texte du bas),
// l'adresse, le prix et le courriel.
export interface TicketDetails {
    accentColor?: string | null;
    logoUrl?: string;
    dateMode?: 'START_DATE_TIME' | 'DATE_RANGE' | 'HIDDEN';
    location?: string;
    price?: string;
    showEmail?: boolean;
    footerText?: string | null;
    // Le numero mene a la page du billet; pas sur cette page meme.
    linkTicket?: boolean;
}

// La couleur du concepteur de billets prend la place de celle de l'organisateur
// ([style*='--theme-accent'], dehors-app.scss), le texte en brun ou en creme selon le fond.
const accentStyle = (color?: string | null): CSSProperties | undefined => {
    const accent = toHexColor(color);
    return accent ? {
        '--theme-accent': accent,
        '--theme-accent-contrast': isLightColor(accent) ? 'var(--dehors-brun)' : 'var(--dehors-creme)',
    } as CSSProperties : undefined;
};

// Le billet de la maquette: le haut couleur accent, la perforation, puis le code QR et le participant.
// Compact, c'est le « Prochain » de Mes billets sur telephone: pose dans une carte, le bas creme,
// le lieu avec la date, et le participant sur une ligne (nom a gauche, numero a droite).
export const ConfirmationTicket = ({attendee, event, compact = false, details}: {
    attendee: Attendee,
    event: Event,
    compact?: boolean,
    details?: TicketDetails,
}) => {
    const isCancelled = attendee.status === 'CANCELLED';
    const isAwaitingPayment = attendee.status === 'AWAITING_PAYMENT';
    const productTitle = getAttendeeProductTitle(attendee, attendee.product as Product);
    const place = details?.location ?? (compact ? getShortLocationDisplay(event.settings?.location_details) : null);
    const dateMode = details?.dateMode ?? 'START_DATE_TIME';
    const ticketPath = `/product/${event.id}/${attendee.short_id}`;
    const showQr = !isCancelled && !isAwaitingPayment;
    const qrFileName = `qr-${attendee.public_id}.png`;
    const qrButton = useRef<HTMLButtonElement>(null);
    // Sur iPhone, l'image est prete avant le toucher: Safari n'ouvre le partage que dans le toucher meme.
    const [qrPhoto, setQrPhoto] = useState<File | null>(null);

    useEffect(() => {
        const svg = qrButton.current?.querySelector('svg');
        if (!showQr || !svg || !canSaveImageToPhotos()) {
            return;
        }
        let current = true;
        qrCodePng(svg).then((png) => {
            if (current && png) {
                setQrPhoto(new File([png], qrFileName, {type: 'image/png'}));
            }
        });
        return () => {
            current = false;
        };
    }, [showQr, qrFileName]);

    // Touche ou clic: le code en image, dans Photos sur iPhone (feuille de partage), telecharge ailleurs.
    const saveQrCode = async () => {
        if (qrPhoto && await shareImage(qrPhoto)) {
            return;
        }
        const svg = qrButton.current?.querySelector('svg');
        if (svg) {
            await downloadQrCode(svg, qrFileName);
        }
    };
    const qrLabel = qrPhoto ? t`Save the QR code to Photos` : t`Download the QR code`;

    return (
        <article className={compact ? `${classes.ticket} ${classes.compact}` : classes.ticket}
                 style={accentStyle(details?.accentColor)}>
            <div className={classes.top}>
                <div className={classes.topRow}>
                    <span className={classes.organizer}>
                        {details?.logoUrl && <img src={details.logoUrl} alt="" className={classes.logo}/>}
                        {event.organizer?.name}
                    </span>
                    {productTitle && !compact && (
                        <span className={classes.typePill} data-rough title={productTitle}>{productTitle}</span>
                    )}
                </div>
                <h3 className={classes.title}>{event.title}</h3>
                <div className={classes.infos}>
                    {dateMode === 'START_DATE_TIME' && (
                        <>
                            <span className={classes.info}>
                                <PublicIcon name={'calendrier'} size={18}/>
                                {shortDayLabel(event.start_date, event.timezone)}
                            </span>
                            <span className={classes.info}>
                                <PublicIcon name={'horloge'} size={18}/>
                                {shortTimeLabel(event.start_date, event.timezone)}
                            </span>
                        </>
                    )}
                    {dateMode === 'DATE_RANGE' && (
                        <span className={classes.info}>
                            <PublicIcon name={'calendrier'} size={18}/>
                            {/* Pas un span direct: sur telephone, ceux de .info (les icones) passent a 16px. */}
                            <bdi><EventDateRange event={event}/></bdi>
                        </span>
                    )}
                    {details?.price && (
                        <span className={classes.info}>
                            <PublicIcon name={'billet'} size={18}/>
                            {details.price}
                        </span>
                    )}
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
                {!showQr ? (
                    <div className={classes.qrPlaceholder} data-rough>
                        <span className={classes.qrPlaceholderIcon}>
                            {isCancelled ? <IconX size={20} stroke={2}/> : <PublicIcon name={'cadenas'} size={20}/>}
                        </span>
                        <span>{isCancelled ? t`Cancelled` : t`Pay to unlock`}</span>
                    </div>
                ) : (
                    <>
                        <button type="button" ref={qrButton} className={classes.qr} data-rough title={qrLabel}
                                aria-label={qrLabel} onClick={saveQrCode}>
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
                        {details?.showEmail && attendee.email && (
                            <span className={classes.email}>{attendee.email}</span>
                        )}
                    </div>
                    {!!attendee.bib_number && (
                        <div className={classes.attendeeNumber}>
                            <span className={classes.label}>{t`Bib`}</span>
                            <span className={classes.value}>{attendee.bib_number}</span>
                        </div>
                    )}
                    <div className={classes.attendeeNumber}>
                        <span className={classes.label}>{t`Ticket`}</span>
                        {details?.linkTicket === false ? (
                            <span className={classes.value}>{attendee.public_id}</span>
                        ) : (
                            <a
                                className={classes.value}
                                href={ticketPath}
                                target="_blank"
                                rel="noreferrer"
                                title={t`View Ticket`}
                            >
                                {attendee.public_id}
                            </a>
                        )}
                    </div>
                </div>

                {details?.footerText && <p className={classes.footerText}>{details.footerText}</p>}
            </div>
        </article>
    );
};
