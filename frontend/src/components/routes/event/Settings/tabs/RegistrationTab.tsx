import {useState} from "react";
import {EventSettings, IdParam} from "../../../../../types.ts";
import {isEmptyHtml} from "../../../../../utilites/helpers.ts";
import {CheckoutCard} from "../cards/CheckoutCard.tsx";
import {WaitlistCard} from "../cards/WaitlistCard.tsx";
import {CheckoutMessagesCard} from "../cards/CheckoutMessagesCard.tsx";
import {InfoBlockCard} from "../cards/InfoBlockCard.tsx";
import {WaiverCard} from "../cards/WaiverCard.tsx";
import {BibNumbersCard} from "../cards/BibNumbersCard.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";

// « Inscription »: the checkout, the waitlist, the bibs, the messages and the information block. Waivers
// are written in Documents now: the card only stays for an event that already has a waiver text, the
// time to empty it.
export const RegistrationTab = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => {
    const [hasWaiver] = useState(() => !!settings.waiver_text && !isEmptyHtml(settings.waiver_text));

    return (
        <div className={classes.grid}>
            <CheckoutCard eventId={eventId} settings={settings}/>
            <WaitlistCard eventId={eventId} settings={settings}/>
            <BibNumbersCard eventId={eventId}/>
            <CheckoutMessagesCard eventId={eventId} settings={settings}/>
            <InfoBlockCard eventId={eventId} settings={settings}/>
            {hasWaiver && <WaiverCard eventId={eventId} settings={settings}/>}
        </div>
    );
};
