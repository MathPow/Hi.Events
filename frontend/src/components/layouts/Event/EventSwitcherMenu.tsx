import {Menu} from "@mantine/core";
import {t} from "@lingui/macro";
import {useLocation, useNavigate} from "react-router";
import {IconCheck, IconList} from "@tabler/icons-react";
import {EventStatus, IdParam} from "../../../types.ts";
import {useGetOrganizerEvents} from "../../../queries/useGetOrganizerEvents.ts";
import {eventStartLabel} from "../../../utilites/eventStartLabel.ts";
import classes from "../AppLayout/NavParts/NavParts.module.scss";

const SWITCHER_EVENTS = {pageNumber: 1, perPage: 20, sortBy: 'start_date', sortDirection: 'desc' as const};

/**
 * The event switcher (the card at the top of the sidebar on an event's pages): the organizer's other
 * events, opened on the same page (Commandes stays Commandes), then all of them.
 */
export const EventSwitcherMenu = ({eventId, organizerId}: { eventId: IdParam, organizerId: IdParam }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const {data} = useGetOrganizerEvents(organizerId, SWITCHER_EVENTS);
    const events = (data?.data ?? []).filter((event) => event.status !== EventStatus.ARCHIVED);
    // The page being looked at (« orders », « settings/payment »…), kept when switching.
    const page = location.pathname.split(`/manage/event/${eventId}/`)[1]?.split('/')[0] || 'dashboard';
    // A single report has no page of its own without its type: back to the list of reports.
    const section = page === 'report' ? 'reports' : page;

    return (
        <>
            {events.length > 1 && (
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
                </>
            )}
            <Menu.Item leftSection={<IconList size={16}/>}
                       onClick={() => navigate(`/manage/organizer/${organizerId}/events`)}>
                {t`All events`}
            </Menu.Item>
        </>
    );
};
