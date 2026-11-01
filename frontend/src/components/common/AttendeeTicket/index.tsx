import {getAttendeeProductPrice} from "../../../utilites/products.ts";
import {CopyButton} from "@mantine/core";
import {formatCurrency} from "../../../utilites/currency.ts";
import {t} from "@lingui/macro";
import {IconCopy, IconPrinter} from "@tabler/icons-react";
import {Address, Attendee, Event, Product} from "../../../types.ts";
import {imageUrl} from "../../../utilites/urlHelper.ts";
import {formatAddress} from "../../../utilites/addressUtilities.ts";
import {PoweredByFooter} from "../PoweredByFooter";
import {ConfirmationTicket} from "../../routes/product-widget/OrderSummaryAndProducts/ConfirmationTicket";
import shell from "../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import classes from './AttendeeTicket.module.scss';

interface AttendeeTicketProps {
    event: Event;
    attendee: Attendee;
    product: Product;
    hideButtons?: boolean;
    showPoweredBy?: boolean;
}

/**
 * One attendee's ticket (its public page, the ticket designer's preview, the attendee panel): the
 * same ticket as the order confirmation and Mes billets, with the ticket designer's settings (color,
 * logo, date, footer text), the address, the price and the email.
 */
export const AttendeeTicket = ({
                                   attendee,
                                   product,
                                   event,
                                   hideButtons = false,
                                   showPoweredBy = false,
                               }: AttendeeTicketProps) => {
    const productPrice = getAttendeeProductPrice(attendee, product);
    const location = event?.settings?.location_details;
    const hasVenue = location?.venue_name || location?.address_line_1;
    const design = event?.settings?.ticket_design_settings;

    return (
        <div className={classes.ticket}>
            <ConfirmationTicket
                attendee={{...attendee, product: attendee.product ?? product}}
                event={event}
                details={{
                    accentColor: design?.accent_color,
                    logoUrl: imageUrl('TICKET_LOGO', event?.images),
                    dateMode: design?.date_display_mode,
                    location: hasVenue ? formatAddress(location as Address) : undefined,
                    price: productPrice > 0 ? formatCurrency(productPrice, event?.currency) : t`Free`,
                    showEmail: true,
                    footerText: design?.footer_text,
                    linkTicket: false,
                }}
            />

            {!hideButtons && (
                <div className={classes.actions}>
                    <button type="button" className={`${shell.button} ${shell.buttonOutline} ${classes.action}`}
                            data-rough="button"
                            onClick={() => window?.open(`/product/${event.id}/${attendee.short_id}/print`, '_blank')}>
                        <IconPrinter size={18}/>
                        {t`Print to PDF`}
                    </button>
                    <CopyButton value={`${window?.location.origin}/product/${event.id}/${attendee.short_id}`}>
                        {({copied, copy}) => (
                            <button type="button" className={`${shell.button} ${shell.buttonOutline} ${classes.action}`}
                                    data-rough="button" onClick={copy}>
                                <IconCopy size={18}/>
                                {copied ? t`Copied` : t`Copy Link`}
                            </button>
                        )}
                    </CopyButton>
                </div>
            )}

            {/* Powered By - Only shown in print mode */}
            {showPoweredBy && (
                <div className={classes.poweredByInTicket}>
                    <PoweredByFooter/>
                </div>
            )}
        </div>
    );
}
