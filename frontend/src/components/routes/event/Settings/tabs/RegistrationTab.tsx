import {EventSettings, IdParam} from "../../../../../types.ts";
import {CheckoutCard} from "../cards/CheckoutCard.tsx";
import {WaitlistCard} from "../cards/WaitlistCard.tsx";
import {CheckoutMessagesCard} from "../cards/CheckoutMessagesCard.tsx";
import {InfoBlockCard} from "../cards/InfoBlockCard.tsx";
import {WaiverCard} from "../cards/WaiverCard.tsx";
import {BibNumbersCard} from "../cards/BibNumbersCard.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";

// « Inscription »: the checkout, its messages and information block, the waiver, the bibs and the waitlist.
export const RegistrationTab = ({eventId, settings}: { eventId: IdParam, settings: EventSettings }) => (
    <div className={classes.grid}>
        <CheckoutCard eventId={eventId} settings={settings}/>
        <WaitlistCard eventId={eventId} settings={settings}/>
        <CheckoutMessagesCard eventId={eventId} settings={settings}/>
        <InfoBlockCard eventId={eventId} settings={settings}/>
        <WaiverCard eventId={eventId} settings={settings}/>
        <BibNumbersCard eventId={eventId}/>
    </div>
);
