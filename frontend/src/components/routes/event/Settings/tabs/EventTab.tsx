import {useState} from "react";
import {Event, EventSettings, IdParam} from "../../../../../types.ts";
import {DetailsCard} from "../cards/DetailsCard.tsx";
import {RecurringEventCard} from "../cards/RecurringEventCard.tsx";
import {LocationCard} from "../cards/LocationCard.tsx";
import {RouteFilesCard} from "../cards/RouteFilesCard.tsx";
import {SeoCard} from "../cards/SeoCard.tsx";
import {DisplayCard} from "../cards/DisplayCard.tsx";
import {WeatherCard} from "../cards/WeatherCard.tsx";
import {DangerZoneCard} from "../cards/DangerZoneCard.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";

interface TabProps {
    eventId: IdParam;
    event: Event;
    settings: EventSettings;
}

// « Événement »: the details, the repeated dates, the place and its courses, Google, the display options, bad weather and the danger zone.
export const EventTab = ({eventId, event, settings}: TabProps) => {
    // « Infos de base » keeps what is being typed: after a postponement it starts again from the new dates.
    const [detailsVersion, setDetailsVersion] = useState(0);

    return (
        <div className={classes.grid}>
            <DetailsCard key={detailsVersion} eventId={eventId} event={event}/>
            <RecurringEventCard eventId={eventId} event={event}/>
            <LocationCard eventId={eventId} settings={settings}/>
            <RouteFilesCard eventId={eventId}/>
            <SeoCard eventId={eventId} event={event} settings={settings}/>
            <DisplayCard eventId={eventId} settings={settings}/>
            <WeatherCard eventId={eventId} event={event} onPostponed={() => setDetailsVersion(version => version + 1)}/>
            <DangerZoneCard eventId={eventId} event={event}/>
        </div>
    );
};
