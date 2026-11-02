import {useEffect, useState} from 'react';
import {NavLink, useLocation, useNavigate, useParams} from "react-router";
import {t} from "@lingui/macro";
import {Button, Skeleton} from "@mantine/core";
import classNames from "classnames";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetEventStats} from "../../../../queries/useGetEventStats.ts";
import {useGetEventOrders} from "../../../../queries/useGetEventOrders.ts";
import {Event, EventDailyStats, QueryFilters} from "../../../../types.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {formatNumber, getInitials} from "../../../../utilites/helpers.ts";
import {eventStartLabel} from "../../../../utilites/eventStartLabel.ts";
import {eventHomepageUrl} from "../../../../utilites/urlHelper.ts";
import {orderContents, orderStatus} from "../../../../utilites/orderSummary.ts";
import {StatTile} from "../../../common/StatBoxes";
import {comparisonLabel, NotificationItem, ScrollList} from "../../organizer/OrganizerDashboard";
import dashboardClasses from "../../organizer/OrganizerDashboard/OrganizerDashboard.module.scss";
import ConfettiAnimation from "./ConfettiAnimation";
import {SetupCard} from "./SetupCard.tsx";
import {lastDaysPreset, SalesChart} from "./SalesChart.tsx";
import {useEventNotifications} from "./eventNotifications.ts";
import classes from "./EventDashboard.module.scss";

const icon = (name: string) => `/interface/admin/tableau/${name}.svg`;
const eventIcon = (name: string) => `/interface/admin/evenement/${name}.svg`;

const RECENT_ORDERS: QueryFilters = {
    pageNumber: 1,
    perPage: 20,
    sortBy: 'created_at',
    sortDirection: 'desc',
};

// « sam. 7 nov. 2026 · 9 h · Parc de la Chute-Montmorency », in the event's time zone.
const eventWhenAndWhere = (event: Event) => {
    const place = event.settings?.is_online_event
        ? t`Online Event`
        : (event.settings?.location_details?.venue_name || event.settings?.location_details?.city);

    return [eventStartLabel(event, true), place].filter(Boolean).join(' · ');
};

// This week against the one before, from the last 14 days.
const weekTotals = (days: EventDailyStats[] | undefined, pick: (day: EventDailyStats) => number) => {
    const list = days ?? [];
    const total = (slice: EventDailyStats[]) => slice.reduce((sum, day) => sum + pick(day), 0);
    return {current: total(list.slice(-7)), previous: total(list.slice(0, Math.max(0, list.length - 7)))};
};

export const DashBoardSkeleton = () => (
    <div className={classes.skeleton}>
        <Skeleton height={81} radius="md" width="60%"/>
        <div className={classes.stats}>
            {[...Array(4)].map((_, index) => <Skeleton key={index} height={190} radius={28}/>)}
        </div>
        <Skeleton height={400} radius={32}/>
    </div>
);

/**
 * The event's dashboard (Figma « Admin · Événement · Tableau de bord »): when and where, the steps
 * left before selling (the former « Commencer » page), the figures, the sales per day, the latest
 * orders and what needs attention.
 */
export const EventDashboard = () => {
    const {eventId} = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const {data: event} = useGetEvent(eventId);
    const statsQuery = useGetEventStats(eventId, lastDaysPreset(14));
    const stats = statsQuery.data;
    const ordersQuery = useGetEventOrders(eventId, RECENT_ORDERS);
    const recentOrders = ordersQuery.data?.data;
    const {notifications, toHandleCount} = useEventNotifications(eventId, event);
    const [showConfetti, setShowConfetti] = useState(false);

    // A new event lands here (?new_event=true): a little celebration.
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('new_event') !== 'true') {
            return;
        }
        setShowConfetti(true);
        const timer = window.setTimeout(() => {
            params.delete('new_event');
            navigate({pathname: location.pathname, search: params.toString()}, {replace: true});
        }, 2000);
        return () => window.clearTimeout(timer);
    }, [location.search]);

    if (!event || !eventId) {
        return <DashBoardSkeleton/>;
    }

    const currency = event.currency;
    const comparison = comparisonLabel(7);
    const sales = weekTotals(stats?.daily_stats, (day) => Number(day.total_sales_gross));
    const products = weekTotals(stats?.daily_stats, (day) => Number(day.products_sold));
    const attendees = weekTotals(stats?.daily_stats, (day) => Number(day.attendees_registered));

    return (
        <div className={classes.page}>
            {showConfetti && <ConfettiAnimation duration={2000}/>}

            <header className={classes.header}>
                <div className={classes.headerText}>
                    <h1 className={classes.title}>{t`Dashboard`}</h1>
                    <p className={classes.subtitle}>{eventWhenAndWhere(event)}</p>
                </div>
                <Button
                    component="a"
                    href={eventHomepageUrl(event)}
                    target="_blank"
                    rel="noopener"
                    className={classes.viewButton}
                    leftSection={<img src={icon('oeil')} alt=""/>}
                >
                    {t`View event page`}
                </Button>
            </header>

            <SetupCard eventId={eventId} event={event}/>

            <section className={classNames(classes.stats, {[classes.statsLoading]: statsQuery.isFetching})}>
                <StatTile
                    tone="sales"
                    iconName="ventes"
                    label={t`Sales`}
                    value={formatCurrency(stats?.total_gross_sales ?? 0, currency)}
                    current={sales.current}
                    previous={sales.previous}
                    comparison={comparison}
                    formatAmount={(amount) => formatCurrency(amount, currency)}
                />
                <StatTile
                    tone="products"
                    iconName="produits"
                    label={t`Products Sold`}
                    value={String(formatNumber(stats?.total_products_sold ?? 0))}
                    current={products.current}
                    previous={products.previous}
                    comparison={comparison}
                />
                <StatTile
                    tone="attendees"
                    iconName="participants"
                    label={t`Attendees`}
                    value={String(formatNumber(stats?.total_attendees_registered ?? 0))}
                    current={attendees.current}
                    previous={attendees.previous}
                    comparison={comparison}
                />
                <StatTile
                    tone="views"
                    iconSrc={eventIcon('vues')}
                    label={t`Page views`}
                    value={String(formatNumber(stats?.total_views ?? 0))}
                />
            </section>

            <SalesChart eventId={eventId} currency={currency}/>

            <div className={classes.bottom}>
                <section className={classNames(classes.card, classes.listCard)}>
                    <div className={classes.sectionTitle}>
                        <h2 className={classes.sectionHeading}>{t`Recent Orders`}</h2>
                        <NavLink to={`/manage/event/${eventId}/orders`} className={classes.seeAll}>
                            {t`View all`}
                            <img src={icon('fleche')} alt=""/>
                        </NavLink>
                    </div>
                    {!recentOrders && <Skeleton height={300} radius={20}/>}
                    {recentOrders && recentOrders.length === 0 && (
                        <p className={classes.empty}>{t`When customers purchase tickets, their orders will appear here.`}</p>
                    )}
                    {recentOrders && recentOrders.length > 0 && (
                        <ScrollList className={classes.ordersList}>
                            {recentOrders.map((order) => {
                                const name = `${order.first_name} ${order.last_name}`.trim();
                                const status = orderStatus(order);

                                return (
                                    <NavLink key={order.id} to={`/manage/event/${eventId}/orders#order-${order.id}`}
                                             className={classes.orderRow}>
                                        <span className={classes.avatar}>{getInitials(name || '?')}</span>
                                        <span className={classes.orderText}>
                                            <span className={classes.orderName}>{name}</span>
                                            <span className={classes.orderContents}>{orderContents(order)}</span>
                                        </span>
                                        <span className={classes.orderEnd}>
                                            <span className={classes.orderAmount}>{formatCurrency(order.total_gross, order.currency)}</span>
                                            <span className={classes.tag} data-tone={status.tone}>{status.label}</span>
                                        </span>
                                    </NavLink>
                                );
                            })}
                        </ScrollList>
                    )}
                </section>

                <section className={classNames(classes.card, classes.listCard)}>
                    <div className={classes.sectionTitle}>
                        <h2 className={classes.sectionHeading}>
                            {t`Notifications`}
                            {toHandleCount > 0 && <span className={classes.countPastille}>{toHandleCount}</span>}
                        </h2>
                    </div>
                    {notifications.length > 0 ? (
                        <ScrollList className={`${dashboardClasses.notificationsList} ${dashboardClasses.notificationsExpanded}`}>
                            {notifications.map((notification) => (
                                <NotificationItem key={notification.id} notification={notification}/>
                            ))}
                        </ScrollList>
                    ) : (
                        <p className={classes.empty}>{t`Nothing to handle for now.`}</p>
                    )}
                </section>
            </div>
        </div>
    );
};

export default EventDashboard;
