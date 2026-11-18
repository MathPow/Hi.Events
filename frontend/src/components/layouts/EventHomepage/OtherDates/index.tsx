import {Link} from "react-router";
import {t} from "@lingui/macro";
import {Event} from "../../../../types.ts";
import {eventHomepagePath} from "../../../../utilites/urlHelper.ts";
import {eventStartLabel} from "../../../../utilites/eventStartLabel.ts";
import page from "../EventPage.module.scss";
import classes from "./OtherDates.module.scss";

// « Autres dates »: the next dates of a repeated outing (the club's weekly run), each to its own page.
export const OtherDates = ({event}: { event: Event }) => {
    const occurrences = event.series_occurrences ?? [];

    if (occurrences.length === 0) {
        return null;
    }

    return (
        <section className={`${page.card} ${page.section} ${classes.otherDates}`} data-rough>
            <h2 className={page.sectionTitle}>{t`Other dates`}</h2>
            <ul className={classes.chips}>
                {occurrences.map((occurrence) => (
                    <li key={occurrence.id}>
                        <Link to={eventHomepagePath(occurrence as Event)} className={classes.chip} data-rough>
                            {eventStartLabel(occurrence)}
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
};
