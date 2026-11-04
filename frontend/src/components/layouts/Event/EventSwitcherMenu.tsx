import {Menu} from "@mantine/core";
import {t} from "@lingui/macro";
import {useLocation, useNavigate} from "react-router";
import {IconCheck, IconList} from "@tabler/icons-react";
import {IdParam} from "../../../types.ts";
import {useGetOrganizerEvents} from "../../../queries/useGetOrganizerEvents.ts";
import {eventStartLabel} from "../../../utilites/eventStartLabel.ts";
import classes from "../AppLayout/NavParts/NavParts.module.scss";

const SWITCHER_LIMIT = 4;

// The events not over yet (archived ones aside), the next one first.
const SWITCHER_EVENTS = {
    pageNumber: 1,
    perPage: SWITCHER_LIMIT,
    sortBy: 'start_date',
    sortDirection: 'asc' as const,
    additionalParams: {eventsStatus: 'upcoming'},
};

/**
 * The event switcher (the card at the top of the sidebar on an event's pages): the organizer's next
 * four events, opened on the same page (Commandes stays Commandes), then « All events » when there are more.
 */
export const EventSwitcherMenu = ({eventId, organizerId}: { eventId: IdParam, organizerId: IdParam }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const {data} = useGetOrganizerEvents(organizerId, SWITCHER_EVENTS);
    const events = data?.data ?? [];
    const hasMore = (data?.meta?.total ?? 0) > SWITCHER_LIMIT;
    // The page being looked at (« orders », « settings/payment »…), kept when switching.
    const page = location.pathname.split(`/manage/event/${eventId}/`)[1]?.split('/')[0] || 'dashboard';
    // A single report has no page of its own without its type: back to the list of reports.
    const section = page === 'report' ? 'reports' : page;

    // Nothing to switch to: the menu starts with the organizer's dashboard.
    if (!events.some((event) => String(event.id) !== String(eventId))) {
        return null;
    }

    return (
        <>
            <Menu.Label>{t`Events`}</Menu.Label>
            {events.map((event) => {
                const current = String(event.id) === String(eventId);
                const cover = event.images?.find((image) => image.type === 'EVENT_COVER');

                return (
                    <Menu.Item
                        key={event.id}
                        leftSection={(
                            <span className={classes.menuEventThumb}
                                  style={cover ? {backgroundImage: `url(${cover.url})`} : undefined}>
                                {!cover && (event.title?.trim().charAt(0).toUpperCase() || '…')}
                            </span>
                        )}
                        rightSection={current ? <IconCheck size={16}/> : undefined}
                        aria-current={current || undefined}
                        classNames={{item: classes.menuEventItem, itemLabel: classes.menuEventLabel}}
                        onClick={() => !current && navigate(`/manage/event/${event.id}/${section}`)}
                    >
                        <span className={classes.menuEventText}>
                            <span>{event.title}</span>
                            <span>{eventStartLabel(event)}</span>
                        </span>
                    </Menu.Item>
                );
            })}
            {hasMore && (
                <Menu.Item leftSection={<IconList size={16}/>}
                           onClick={() => navigate(`/manage/organizer/${organizerId}/events`)}>
                    {t`All events`}
                </Menu.Item>
            )}
            <Menu.Divider/>
        </>
    );
};
