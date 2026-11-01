import {ReactNode, useEffect, useRef, useState} from 'react';
import {NavLink, useParams} from "react-router";
import {t} from "@lingui/macro";
import {AreaChart} from "@mantine/charts";
import {Button, Menu, Skeleton, UnstyledButton} from "@mantine/core";
import classNames from "classnames";
import {useGetEvent} from "../../../../queries/useGetEvent.ts";
import {useGetMe} from "../../../../queries/useGetMe.ts";
import {useGetEventStats} from "../../../../queries/useGetEventStats.ts";
import {useGetAccount} from "../../../../queries/useGetAccount.ts";
import {useGetEventOrders} from "../../../../queries/useGetEventOrders.ts";
import {useUpdateEventStatus} from "../../../../mutations/useUpdateEventStatus.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {formatDateWithLocale} from "../../../../utilites/dates.ts";
import {confirmationDialog} from "../../../../utilites/confirmationDialog.tsx";
import {showSuccess} from "../../../../utilites/notifications.tsx";
import {getInitials, isHiEvents} from "../../../../utilites/helpers.ts";
import {trackEvent, AnalyticsEvents} from "../../../../utilites/analytics.ts";
import {EventLifecycleStatus, EventStatus, Order, QueryFilters, StripePlatform} from "../../../../types.ts";
import {StatBoxes} from "../../../common/StatBoxes";
import {StripeConnectButton} from "../../../common/StripeConnectButton";
import {OrderStatusBadge} from "../../../common/OrderStatusBadge";
import {PublicIcon} from "../../../common/PublicIcon";
import {showStatusChangeError} from "../../../common/EmailNotConfirmedError";
import {useOrderDate} from "../../../../utilites/orderDate.ts";
import classes from "./EventDashboard.module.scss";

const icon = (name: string) => `/interface/admin/tableau/${name}.svg`;

type DateRange = 'last_30_days' | 'week' | 'month' | 'quarter' | 'event';

const DATE_RANGES: DateRange[] = ['last_30_days', 'week', 'month', 'quarter', 'event'];

const dateRangeLabel = (range: DateRange, short = false) => {
    if (short) {
        return ({
            last_30_days: t`Recent`,
            week: t`Week`,
            month: t`Month`,
            quarter: t`Quarter`,
            event: t`Event`,
        })[range];
    }
    return ({
        last_30_days: t`Last 30 days`,
        week: t`First 7 days from event start`,
        month: t`First 30 days from event start`,
        quarter: t`First 90 days from event start`,
        event: t`Full event duration`,
    })[range];
};

const RECENT_ORDERS: QueryFilters = {
    pageNumber: 1,
    perPage: 5,
    sortBy: 'created_at',
    sortDirection: 'desc',
};

const ticketCount = (order: Order) =>
    (order.order_items ?? []).reduce((total, item) => total + (item.quantity ?? 0), 0);

export const DashBoardSkeleton = () => {
    return (
        <div className={classes.skeleton}>
            <div className={classes.skeletonTiles}>
                {[...Array(6)].map((_, index) => <Skeleton key={index} height={170} radius={28}/>)}
            </div>
            <Skeleton height={420} radius={32}/>
        </div>
    );
}

// A step of « Préparez votre événement »: a check once done, the action otherwise.
const SetupStep = ({done, number, title, description, action}: {
    done: boolean,
    number: number,
    title: string,
    description: string,
    action?: ReactNode,
}) => (
    <div className={classes.step} data-done={done || undefined}>
        <span className={classes.stepPastille}>
            {done ? <PublicIcon name="coche" size={18}/> : number}
        </span>
        <div className={classes.stepText}>
            <span className={classes.stepTitle}>{title}</span>
            <span className={classes.stepDescription}>{description}</span>
        </div>
        {action && <div className={classes.stepAction}>{action}</div>}
    </div>
);

/**
 * The event's dashboard, like the organizer's (Figma « Admin · Tableau de bord »): the figures since
 * the start, the sales and revenue over a chosen period and the latest orders.
 */
export const EventDashboard = () => {
    const {eventId} = useParams();
    const eventQuery = useGetEvent(eventId);
    const {data: me} = useGetMe();
    const event = eventQuery?.data;
    const defaultDateRangeRef = useRef<DateRange | null>(null);
    if (event && !defaultDateRangeRef.current) {
        defaultDateRangeRef.current = (event.lifecycle_status === EventLifecycleStatus.ENDED
            || event.status === EventStatus.ARCHIVED) ? 'event' : 'last_30_days';
    }
    const [dateRange, setDateRange] = useState<DateRange | null>(null);
    const effectiveDateRange: DateRange = dateRange ?? defaultDateRangeRef.current ?? 'last_30_days';

    const eventStatsQuery = useGetEventStats(eventId, effectiveDateRange, !!defaultDateRangeRef.current);
    const {data: eventStats} = eventStatsQuery;
    const ordersQuery = useGetEventOrders(eventId, RECENT_ORDERS);
    const recentOrders = ordersQuery.data?.data;
    const {data: account, isFetched: accountIsFetched} = useGetAccount();
    const statusToggleMutation = useUpdateEventStatus();
    const formatOrderDate = useOrderDate();

    const [isChecklistVisible, setIsChecklistVisible] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    const showStripeUpgradeNotice = account?.stripe_platform === StripePlatform.Canada.valueOf()
        && account?.stripe_connect_setup_complete
        && isHiEvents();

    useEffect(() => {
        setIsMounted(true);
        const dismissed = window.localStorage.getItem('setupChecklistDismissed-' + eventId);
        if (dismissed === 'true') {
            setIsChecklistVisible(false);
        }
    }, []);

    const dismissChecklist = () => {
        setIsChecklistVisible(false);
        if (isMounted) {
            window.localStorage.setItem('setupChecklistDismissed-' + eventId, 'true');
        }
    };

    const handleStatusToggle = () => {
        const newStatus = event?.status === 'LIVE' ? 'DRAFT' : 'LIVE';
        const message = event?.status === 'LIVE'
            ? t`Are you sure you want to make this event draft? This will make the event invisible to the public`
            : t`Are you sure you want to make this event public? This will make the event visible to the public`;

        confirmationDialog(message, () => {
            statusToggleMutation.mutate({
                eventId,
                status: newStatus
            }, {
                onSuccess: () => {
                    if (newStatus === 'LIVE') {
                        trackEvent(AnalyticsEvents.EVENT_PUBLISHED);
                    }
                    showSuccess(t`Event status updated`);
                },
                onError: (error: any) => {
                    showStatusChangeError(error, t`Event status update failed. Please try again later`);
                }
            });
        })
    }

    const dateRangeText = (eventStats && event)
        ? `${formatDateWithLocale(eventStats.start_date, 'chartDate', event?.timezone)} – ${formatDateWithLocale(eventStats.end_date, 'chartDate', event?.timezone)}`
        : '';

    const shouldShowChecklist = (isChecklistVisible && event && accountIsFetched && account?.is_saas_mode_enabled) && (
        !account?.stripe_connect_setup_complete ||
        event?.status !== 'LIVE'
    );

    const firstName = me?.first_name ?? '';
    const eventTitle = event?.title ?? '';
    const isLive = event?.status === 'LIVE';

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <h1 className={classes.title}>{t`Dashboard`}</h1>
                <p className={classes.subtitle}>
                    <span className={classes.desktopOnly}>
                        {firstName
                            ? t`Welcome back, ${firstName}! Here's how ${eventTitle} is doing.`
                            : t`Here's how ${eventTitle} is doing.`}
                    </span>
                    {firstName && <span className={classes.mobileOnly}>{t`Welcome back, ${firstName}!`}</span>}
                </p>
            </header>

            {!event && <DashBoardSkeleton/>}

            {showStripeUpgradeNotice && (
                <section className={classes.notice}>
                    <span className={classes.noticePastille}><img src={icon('alerte')} alt=""/></span>
                    <div className={classes.noticeText}>
                        <h2>{t`Important: Stripe reconnection required`}</h2>
                        <p>{t`We've relocated our headquarters to Ireland. As a result, we need you to reconnect your Stripe account. This quick process takes just a few minutes. Your sales and existing data remain completely unaffected.`}</p>
                        <p>{t`Sorry for the inconvenience.`}</p>
                    </div>
                    <StripeConnectButton
                        className={classes.noticeButton}
                        buttonText={t`Reconnect Stripe →`}
                        variant="filled"
                        size="md"
                        platform="ie"
                    />
                </section>
            )}

            {event && (<>
                {shouldShowChecklist && (
                    <section className={classNames(classes.card, classes.setupCard)}>
                        <div className={classes.sectionTitle}>
                            <h2>{t`Get your event ready`}</h2>
                            <UnstyledButton className={classes.closeButton} onClick={dismissChecklist}
                                            aria-label={t`Hide`} title={t`Hide`}>
                                <img src={icon('fermer')} alt=""/>
                            </UnstyledButton>
                        </div>
                        <p className={classes.cardText}>
                            {t`Complete these steps to start selling tickets for your event.`}
                        </p>
                        <div className={classes.steps}>
                            <SetupStep
                                number={1}
                                done={isLive}
                                title={t`Make your event live`}
                                description={t`Your event must be live before you can sell tickets to attendees.`}
                                action={(
                                    <Button onClick={handleStatusToggle}
                                            variant={isLive ? 'outline' : 'filled'}
                                            className={isLive ? classes.outlineButton : classes.primaryButton}>
                                        {isLive ? t`Unpublish Event` : t`Publish Event`}
                                    </Button>
                                )}
                            />
                            <SetupStep
                                number={2}
                                done={!!account?.stripe_connect_setup_complete}
                                title={t`Connect payment processing`}
                                description={t`Link your Stripe account to receive funds from ticket sales.`}
                                action={!account?.stripe_connect_setup_complete && (
                                    <Button component={NavLink} to="/account/payment"
                                            className={classes.primaryButton}>
                                        {account?.stripe_account_id ? t`Complete Stripe Setup` : t`Connect to Stripe`}
                                    </Button>
                                )}
                            />
                        </div>
                    </section>
                )}

                <StatBoxes/>

                <section className={classes.section}>
                    <div className={classes.sectionHeader}>
                        <h2 className={classes.sectionHeading}>{t`Sales over time`}</h2>
                        <Menu position="bottom-end" width={320} withinPortal>
                            <Menu.Target>
                                <UnstyledButton className={classes.selector}>
                                    <img src={icon('periode')} alt="" className={classes.desktopOnly}/>
                                    <span className={classes.desktopOnly}>{dateRangeLabel(effectiveDateRange)}</span>
                                    <span className={classes.mobileOnly}>{dateRangeLabel(effectiveDateRange, true)}</span>
                                    <img src={icon('chevron-bas')} alt=""/>
                                </UnstyledButton>
                            </Menu.Target>
                            <Menu.Dropdown>
                                {DATE_RANGES.map((range) => (
                                    <Menu.Item
                                        key={range}
                                        onClick={() => setDateRange(range)}
                                        data-selected={range === effectiveDateRange || undefined}
                                        className={classes.periodOption}
                                    >
                                        {dateRangeLabel(range)}
                                    </Menu.Item>
                                ))}
                            </Menu.Dropdown>
                        </Menu>
                    </div>

                    <div className={classNames(classes.charts, {[classes.chartsLoading]: eventStatsQuery.isFetching})}>
                        <section className={classNames(classes.card, classes.chartCard)}>
                            <div className={classes.sectionTitle}>
                                <h2>{t`Product Sales`}</h2>
                                <span className={classes.dateRange}>{dateRangeText}</span>
                            </div>
                            <AreaChart
                                h={300}
                                data={eventStats?.daily_stats.map(stat => ({
                                    date: formatDateWithLocale(stat.date, 'chartDate', event.timezone),
                                    orders_created: stat.orders_created,
                                    products_sold: stat.products_sold,
                                    attendees_registered: stat.attendees_registered,
                                })) || []}
                                dataKey="date"
                                withLegend
                                legendProps={{verticalAlign: 'bottom', height: 50}}
                                series={[
                                    {name: 'orders_created', color: '#fa7853', label: t`Completed Orders`},
                                    {name: 'products_sold', color: '#e3ad92', label: t`Products Sold`},
                                    {name: 'attendees_registered', color: '#352924', label: t`Attendees Registered`},
                                ]}
                                curveType="bump"
                                tickLine="none"
                                className={classes.chart}
                                areaChartProps={{syncId: 'events'}}
                            />
                        </section>

                        <section className={classNames(classes.card, classes.chartCard)}>
                            <div className={classes.sectionTitle}>
                                <h2>{t`Revenue`}</h2>
                                <span className={classes.dateRange}>{dateRangeText}</span>
                            </div>
                            <AreaChart
                                h={300}
                                data={eventStats?.daily_stats.map(stat => ({
                                    date: formatDateWithLocale(stat.date, 'chartDate', event.timezone),
                                    total_fees: stat.total_fees,
                                    total_sales_gross: stat.total_sales_gross,
                                    total_tax: stat.total_tax,
                                    total_refunded: stat.total_refunded,
                                })) || []}
                                dataKey="date"
                                valueFormatter={(value) => formatCurrency(value, event.currency)}
                                withLegend
                                legendProps={{verticalAlign: 'bottom', height: 50}}
                                series={[
                                    {name: 'total_sales_gross', label: t`Gross Sales`, color: '#fa7853'},
                                    {name: 'total_fees', label: t`Total Fees`, color: '#e3ad92'},
                                    {name: 'total_tax', label: t`Total Tax`, color: '#352924'},
                                    {name: 'total_refunded', label: t`Total Refunded`, color: '#9a3b25'},
                                ]}
                                curveType="natural"
                                tickLine="none"
                                className={classes.chart}
                                areaChartProps={{syncId: 'events'}}
                            />
                        </section>
                    </div>
                </section>

                <section className={classNames(classes.card, classes.ordersCard)}>
                    <div className={classes.sectionTitle}>
                        <h2>{t`Recent Orders`}</h2>
                        <NavLink to={`/manage/event/${eventId}/orders`} className={classes.seeAll}>
                            {t`View all`}
                            <img src={icon('fleche')} alt=""/>
                        </NavLink>
                    </div>
                    {!recentOrders && <Skeleton height={180} radius={20}/>}
                    {recentOrders && recentOrders.length === 0 && (
                        <div className={classes.empty}>
                            <p>{t`When customers purchase tickets, their orders will appear here.`}</p>
                        </div>
                    )}
                    {recentOrders && recentOrders.length > 0 && (
                        <div className={classes.orders} role="table" aria-label={t`Recent Orders`}>
                            <div className={classes.tableHead} role="row">
                                <span className={classes.colCustomer} role="columnheader">{t`Customer`}</span>
                                <span className={classes.colTickets} role="columnheader">{t`Tickets`}</span>
                                <span className={classes.colAmount} role="columnheader">{t`Amount`}</span>
                                <span className={classes.colDate} role="columnheader">{t`Date`}</span>
                                <span className={classes.colStatus} role="columnheader">{t`Status`}</span>
                            </div>
                            {recentOrders.map((order) => {
                                const name = `${order.first_name} ${order.last_name}`.trim();

                                return (
                                    <NavLink key={order.id} role="row"
                                             to={`/manage/event/${eventId}/orders#order-${order.id}`}
                                             className={classes.orderRow}>
                                        <span className={classes.colCustomer} role="cell">
                                            <span className={classes.avatar}>{getInitials(name || '?')}</span>
                                            <span className={classes.customerText}>
                                                <span className={classes.customerName}>{name}</span>
                                                <span className={classes.orderId}>#{order.public_id}</span>
                                            </span>
                                        </span>
                                        <span className={classes.colTickets} role="cell">{ticketCount(order)}</span>
                                        <span className={classes.colAmount} role="cell">
                                            {formatCurrency(order.total_gross, order.currency)}
                                            <span className={classes.orderDateMobile}>{formatOrderDate(order.created_at)}</span>
                                        </span>
                                        <span className={classes.colDate} role="cell">{formatOrderDate(order.created_at)}</span>
                                        <span className={classes.colStatus} role="cell">
                                            <OrderStatusBadge order={order}/>
                                        </span>
                                    </NavLink>
                                );
                            })}
                        </div>
                    )}
                </section>
            </>)}
        </div>
    )
};

export default EventDashboard;
