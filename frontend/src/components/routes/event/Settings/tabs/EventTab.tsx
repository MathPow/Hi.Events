import {Event, EventSettings, IdParam} from "../../../../../types.ts";
import {DetailsCard} from "../cards/DetailsCard.tsx";
import {RecurringEventCard} from "../cards/RecurringEventCard.tsx";
import {LocationCard} from "../cards/LocationCard.tsx";
import {SeoCard} from "../cards/SeoCard.tsx";
import {DisplayCard} from "../cards/DisplayCard.tsx";
import {DangerZoneCard} from "../cards/DangerZoneCard.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";

interface TabProps {
    eventId: IdParam;
    event: Event;
    settings: EventSettings;
}

// « Événement »: the details, the repeated dates, the place, Google, the display options and the danger zone.
export const EventTab = ({eventId, event, settings}: TabProps) => (
    <div className={classes.grid}>
        <DetailsCard eventId={eventId} event={event}/>
        <RecurringEventCard eventId={eventId} event={event}/>
        <LocationCard eventId={eventId} settings={settings}/>
        <SeoCard eventId={eventId} event={event} settings={settings}/>
        <DisplayCard eventId={eventId} settings={settings}/>
        <DangerZoneCard eventId={eventId} event={event}/>
    </div>
);
