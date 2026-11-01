import {Event, EventSettings, IdParam} from "../../../../../types.ts";
import {EmailSettingsCard} from "../cards/EmailSettingsCard.tsx";
import {EmailTemplatesCard} from "../cards/EmailTemplatesCard.tsx";
import classes from "../../../organizer/Settings/Settings.module.scss";

interface TabProps {
    eventId: IdParam;
    event: Event;
    settings: EventSettings;
}

// « Courriels »: replies, footer and notifications, and the event's own versions of the automatic emails.
export const EmailsTab = ({eventId, event, settings}: TabProps) => (
    <div className={`${classes.grid} ${classes.gridTop}`}>
        <EmailSettingsCard eventId={eventId} settings={settings}/>
        <EmailTemplatesCard eventId={eventId} event={event}/>
    </div>
);
