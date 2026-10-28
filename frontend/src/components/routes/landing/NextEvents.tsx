import {CSSProperties, useRef} from "react";
import {Link} from "react-router";
import {t} from "@lingui/macro";
import {Event} from "../../../types.ts";
import {useGetUpcomingEventsPublic} from "../../../queries/useGetUpcomingEventsPublic.ts";
import {eventCoverImageUrl, eventHomepagePath} from "../../../utilites/urlHelper.ts";
import {shortDayLabel} from "../product-widget/OrderSummaryAndProducts/confirmationDates.ts";
import classes from "./Landing.module.scss";
import {useMarqueePace} from "./useMarqueePace.ts";

const COPIES = 4;
// Enough events in a copy for it to be wider than a wide screen.
const MIN_EVENTS_PER_COPY = 6;
const SECONDS_PER_EVENT = 7;
// Stopped under the mouse, for the event to be clicked.
const HOVER_PACE = 0;

const metaLabel = (event: Event) => {
    const city = event.settings?.location_details?.city?.trim();
    const day = shortDayLabel(event.start_date, event.timezone);

    return city ? `${day} · ${city}` : day;
};

const EventPill = ({event}: { event: Event }) => {
    const cover = eventCoverImageUrl(event);

    return (
        // Out of the tab order: the list above the row holds the same links.
        <Link to={eventHomepagePath(event)} tabIndex={-1} className={classes.nextEvent}>
            <span className={classes.nextEventPicture}>
                {cover && <img src={cover} alt="" loading="lazy" decoding="async"/>}
            </span>
            <span className={classes.nextEventText}>
                <span className={classes.nextEventTitle}>{event.title}</span>
                <span className={classes.nextEventMeta}>{metaLabel(event)}</span>
            </span>
        </Link>
    );
};

/**
 * The platform's next events under the hero, as small pills rolling to the
 * right like the organizers' row: stopped under the mouse to be clicked,
 * faster as the page scrolls. Nothing when no event is coming up.
 */
export const NextEvents = () => {
    const {data: events = []} = useGetUpcomingEventsPublic();
    const scroller = useRef<HTMLDivElement>(null);
    const hovering = useMarqueePace(scroller, classes.nextEventsTrack, HOVER_PACE, events.length > 0);

    if (!events.length) {
        return null;
    }

    const repeated = Array.from({length: Math.ceil(MIN_EVENTS_PER_COPY / events.length)}, () => events).flat();

    return (
        <section className={classes.nextEvents} aria-labelledby="next-events-title">
            <h2 id="next-events-title" className={classes.nextEventsTitle}>{t`Upcoming Events`}</h2>
            <ul className={`${classes.visuallyHidden} ${classes.nextEventsNames}`}>
                {events.map((event) => (
                    <li key={event.id}><Link to={eventHomepagePath(event)}>{event.title}</Link></li>
                ))}
            </ul>
            <div ref={scroller} className={classes.nextEventsScroller} aria-hidden="true"
                 onPointerEnter={(event) => hovering.current = event.pointerType === 'mouse'}
                 onPointerLeave={() => hovering.current = false}>
                <div className={classes.nextEventsTrack}
                     style={{'--duration': `${repeated.length * SECONDS_PER_EVENT}s`} as CSSProperties}>
                    {Array.from({length: COPIES}).map((_, copy) => (
                        <ul key={copy} className={classes.nextEventsCopy}>
                            {repeated.map((event, index) => (
                                <li key={index}><EventPill event={event}/></li>
                            ))}
                        </ul>
                    ))}
                </div>
            </div>
        </section>
    );
};
