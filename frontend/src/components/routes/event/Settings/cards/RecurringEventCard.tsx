import {useState} from "react";
import {Link} from "react-router";
import {t} from "@lingui/macro";
import {Button} from "@mantine/core";
import {Event, IdParam} from "../../../../../types.ts";
import {SettingsCard} from "../../../organizer/Settings/SettingsUi.tsx";
import {RepeatEventModal} from "../../../../modals/RepeatEventModal";
import classes from "../../../organizer/Settings/Settings.module.scss";
import extra from "../EventSettings.module.scss";

// « Sortie récurrente »: the next dates of a weekly outing created in one go, from this event.
export const RecurringEventCard = ({eventId, event}: { eventId: IdParam, event: Event }) => {
    const [open, setOpen] = useState(false);
    const organizerId = event.organizer?.id ?? event.organizer_id;

    return (
        <SettingsCard
            id="recurring-event"
            className={extra.anchored}
            full
            title={t`Recurring outing`}
            subtitle={t`The same outing every week, every two weeks or every month: create its next dates in one go, each with its tickets and its settings.`}
            action={(
                <Button variant="transparent" className={classes.inkButton} onClick={() => setOpen(true)}>
                    {t`Repeat this event`}
                </Button>
            )}
        >
            {event.series_id && (
                <p className={classes.softHint}>
                    {t`This event is part of a series of dates: the new ones are added to it.`}
                    {organizerId && (
                        <>
                            {' '}
                            <Link to={`/manage/organizer/${organizerId}/events`} className={extra.inlineLink}>
                                {t`See the events`}
                            </Link>
                        </>
                    )}
                </p>
            )}
            {open && <RepeatEventModal eventId={eventId} event={event} onClose={() => setOpen(false)}/>}
        </SettingsCard>
    );
};
