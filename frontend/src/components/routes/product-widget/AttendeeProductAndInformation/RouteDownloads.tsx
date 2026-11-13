import {t} from "@lingui/macro";
import {IconRoute} from "@tabler/icons-react";
import {IdParam} from "../../../../types.ts";
import {eventRouteFileClientPublic, formatRouteFileSize} from "../../../../api/eventRouteFile.client.ts";
import {useGetEventRouteFilesPublic} from "../../../../queries/useGetEventRouteFilesPublic.ts";
import shell from "../../../layouts/OrganizerHomepage/OrganizerHomepage.module.scss";
import print from "../PrintOrder/PrintOrder.module.scss";
import classes from './AttendeeProductAndInformation.module.scss';

// « Parcours »: the event's GPX courses, one download each, under the ticket. Nothing without any.
export const RouteDownloads = ({eventId}: { eventId: IdParam }) => {
    const {data: routeFiles} = useGetEventRouteFilesPublic(eventId);

    if (!routeFiles?.length) {
        return null;
    }

    return (
        <section id="parcours" className={`${classes.routeCard} ${print.screenOnly}`} data-rough>
            <h2 className={classes.routeTitle}>{t`Route`}</h2>
            <p className={classes.routeIntro}>{t`Load it into your watch or phone before the start.`}</p>
            <div className={classes.routeButtons}>
                {routeFiles.map((routeFile) => {
                    const label = routeFile.label;
                    const size = formatRouteFileSize(routeFile.size);

                    return (
                        <a key={routeFile.id}
                           href={eventRouteFileClientPublic.downloadUrl(eventId, routeFile.id)}
                           className={`${shell.button} ${shell.buttonOutline} ${classes.routeButton}`}
                           data-rough="button">
                            <IconRoute size={20} stroke={1.75} aria-hidden/>
                            <span className={classes.routeButtonText}>
                                <span>{t`Download the route · ${label}`}</span>
                                <span className={classes.routeFormat}>{t`GPX · ${size}`}</span>
                            </span>
                        </a>
                    );
                })}
            </div>
        </section>
    );
};
