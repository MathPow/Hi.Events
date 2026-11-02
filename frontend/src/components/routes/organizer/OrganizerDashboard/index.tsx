import {ReactNode, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {NavLink, useParams} from "react-router";
import {Button, Menu, Skeleton, UnstyledButton} from '@mantine/core';
import {IconCalendarEvent, IconPlus} from '@tabler/icons-react';
import {t} from '@lingui/macro';
import {useLingui} from "@lingui/react";
import classNames from "classnames";

import {useGetOrganizerStats} from "../../../../queries/useGetOrganizerStats.ts";
import {useGetEvents} from "../../../../queries/useGetEvents.ts";
import {useGetOrganizerOrders} from "../../../../queries/useGetOrganizerOrders.ts";
import {useGetOrganizer} from "../../../../queries/useGetOrganizer.ts";
import {useGetAccount} from "../../../../queries/useGetAccount.ts";
import {useGetMe} from "../../../../queries/useGetMe.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {relativeDate} from "../../../../utilites/dates.ts";
import {formatNumber, getInitials} from "../../../../utilites/helpers.ts";
import {getEventQueryFilters} from "../../../../utilites/eventsPageFiltersHelper.ts";
import {Event, Order, QueryFilters} from '../../../../types';
import {currenciesMap} from "../../../../../data/currencies.ts";
import {CreateEventModal} from "../../../modals/CreateEventModal";
import {StripeConnectButton} from "../../../common/StripeConnectButton";
import {DashboardNotification, useDashboardNotifications} from "./dashboardData.ts";
import {getEventSaleStatus, getTicketCapacity, saleStatusLabel} from "../../../../utilites/eventSales.ts";
import {StatTile} from "../../../common/StatBoxes";
import {useOrderDate} from "../../../../utilites/orderDate.ts";
import classes from './OrganizerDashboard.module.scss';

const icon = (name: string) => `/interface/admin/tableau/${name}.svg`;

// Repris par la page Rapports (meme periode, gardee dans PERIOD_STORAGE_KEY).
export const PERIODS: (number | null)[] = [7, 30, 90, 365, null];
// All time until the organizer picks a period (then remembered).
const DEFAULT_PERIOD: number | null = null;
export const PERIOD_STORAGE_KEY = 'dehors-dashboard-period';

export const periodLabel = (days: number | null) => {
    switch (days) {
        case 7:
            return t`Last 7 days`;
        case 30:
            return t`Last 30 days`;
        case 90:
            return t`Last 90 days`;
        case 365:
            return t`Last 12 months`;
        default:
            return t`All time`;
    }
};

export const comparisonLabel = (days: number) => {
    switch (days) {
        case 7:
            return t`vs the 7 days before`;
        case 90:
            return t`vs the 90 days before`;
        case 365:
            return t`vs the 12 months before`;
        default:
            return t`vs the 30 days before`;
    }
};

// French dates read « sam. 7 nov. » and « 9 h 12 » the Quebec way.
const intlLocale = (locale: string) => locale.startsWith('fr') ? 'fr-CA' : locale;

const ticketCount = (order: Order) =>
    (order.order_items ?? []).reduce((total, item) => total + (item.quantity ?? 0), 0);

export const readPeriod = (): number | null => {
    try {
        const stored = localStorage.getItem(PERIOD_STORAGE_KEY);
        if (stored === null) {
            return DEFAULT_PERIOD;
        }
        return stored === 'all' ? null : (PERIODS.includes(Number(stored)) ? Number(stored) : DEFAULT_PERIOD);
    } catch {
        return DEFAULT_PERIOD;
    }
};

// A list that scrolls inside its card, with a fade while there is more below (also on the event's dashboard).
export const ScrollList = ({children, className}: { children: ReactNode, className?: string }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [moreBelow, setMoreBelow] = useState(false);

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) {
            return;
        }
        const update = () => setMoreBelow(element.scrollTop + element.clientHeight < element.scrollHeight - 4);
        update();
        element.addEventListener('scroll', update, {passive: true});
        const observer = new ResizeObserver(update);
        observer.observe(element);
        Array.from(element.children).forEach((child) => observer.observe(child));
        return () => {
            element.removeEventListener('scroll', update);
            observer.disconnect();
        };
    }, [children]);

    return (
        <div className={classNames(classes.scrollWrap, className)}>
            <div ref={ref} className={classes.scroll}>
                {children}
            </div>
            <div className={classNames(classes.fade, {[classes.fadeVisible]: moreBelow})} aria-hidden/>
        </div>
    );
};

// Les chiffres (tuiles) sont partages avec les pages de l'evenement: components/common/StatBoxes.
export {StatTile};

const EventRow = ({event}: { event: Event }) => {
    const {i18n} = useLingui();
    const capacity = getTicketCapacity(event);
    const status = getEventSaleStatus(event, capacity);
    const cover = event.images?.find((image) => image.type === 'EVENT_COVER');
    const location = event.settings?.is_online_event
        ? t`Online Event`
        : (event.settings?.location_details?.venue_name || event.settings?.location_details?.city);
    const date = event.start_date
        ? new Intl.DateTimeFormat(intlLocale(i18n.locale), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            timeZone: event.timezone || undefined,
        }).format(new Date(event.start_date))
        : null;
    const progress = capacity.capacity ? Math.min(100, (capacity.sold / capacity.capacity) * 100) : 0;

    return (
        <NavLink to={`/manage/event/${event.id}/dashboard`} className={classes.eventRow}>
            <span className={classes.eventImage}
                  style={cover ? {backgroundImage: `url(${cover.url})`} : undefined}>
                {!cover && <IconCalendarEvent size={24} stroke={1.75}/>}
            </span>
            <span className={classes.eventInfo}>
                {date && <span className={classes.eventDate}>{date}</span>}
                <span className={classes.eventTitle}>{event.title}</span>
                {location && <span className={classes.eventLocation}>{location}</span>}
                <span className={classes.eventProgressMobile}>
                    {capacity.capacity && (
                        <span className={classes.progress}>
                            <span style={{width: `${progress}%`}}/>
                        </span>
                    )}
                    <span>
                        {capacity.capacity
                            ? `${capacity.sold}/${capacity.capacity}`
                            : t`${capacity.sold} tickets`}
                    </span>
                </span>
            </span>
            <span className={classes.eventTickets}>
                <span>
                    {capacity.capacity
                        ? t`${capacity.sold} / ${capacity.capacity} tickets`
                        : t`${capacity.sold} tickets`}
                </span>
                {capacity.capacity && (
                    <span className={classes.progress}>
                        <span style={{width: `${progress}%`}}/>
                    </span>
                )}
            </span>
            <span className={classes.eventStatus}>
                <span className={classes.tag} data-status={status}>{saleStatusLabel(status)}</span>
            </span>
            <img src={icon('chevron-droite')} alt="" className={classes.eventChevron}/>
        </NavLink>
    );
};

const notificationIcon = (notification: DashboardNotification) => {
    switch (notification.kind) {
        case 'payment':
            return 'ventes';
        case 'almost_full':
            return 'participants';
        default:
            return 'alerte';
    }
};

export const NotificationItem = ({notification}: { notification: DashboardNotification }) => (
    <div className={classNames(classes.notification, {[classes.notificationRead]: !notification.unread})}>
        <span className={classes.notificationPastille}
              data-urgent={notification.kind === 'message' && notification.unread ? '' : undefined}>
            <img src={icon(notificationIcon(notification))} alt=""/>
        </span>
        <div className={classes.notificationBody}>
            <div className={classes.notificationTitle}>
                <span>{notification.title}</span>
                {notification.unread && <span className={classes.unreadDot} aria-label={t`Unread`}/>}
            </div>
            <p className={classes.notificationText}>{notification.body}</p>
            <div className={classes.notificationFooter}>
                <span>{notification.date ? relativeDate(notification.date) : ''}</span>
                {notification.action && (
                    <NavLink to={notification.action.link} className={classes.inlineLink}>
                        {notification.action.label}
                        <img src={icon('fleche-petite')} alt=""/>
                    </NavLink>
                )}
            </div>
        </div>
    </div>
);

const orderStatus = (order: Order): { label: string, tone: 'done' | 'waiting' | 'neutral' } => {
    if (order.status === 'CANCELLED') {
        return {label: t`Cancelled`, tone: 'neutral'};
    }
    if (order.refund_status === 'REFUNDED') {
        return {label: t`Refunded`, tone: 'neutral'};
    }
    if (order.refund_status === 'PARTIALLY_REFUNDED') {
        return {label: t`Partially Refunded`, tone: 'waiting'};
    }
    if (order.status === 'AWAITING_OFFLINE_PAYMENT' || order.payment_status === 'AWAITING_PAYMENT') {
        return {label: t`Awaiting Payment`, tone: 'waiting'};
    }
    return {label: t`Completed`, tone: 'done'};
};

const SectionTitle = ({children, link}: { children: ReactNode, link?: string }) => (
    <div className={classes.sectionTitle}>
        <h2>{children}</h2>
        {link && (
            <NavLink to={link} className={classes.seeAll}>
                {t`View all`}
                <img src={icon('fleche')} alt=""/>
            </NavLink>
        )}
    </div>
);

export const DashboardSkeleton = () => (
    <div className={classes.page}>
        <Skeleton height={81} radius="md" width="60%"/>
        <div className={classes.stats}>
            {[...Array(4)].map((_, index) => <Skeleton key={index} height={190} radius={28}/>)}
        </div>
        <div className={classes.middle}>
            <Skeleton height={560} radius={32}/>
            <Skeleton height={560} radius={32}/>
        </div>
    </div>
);

export const OrganizerDashboard = () => {
    const {organizerId} = useParams<{ organizerId: string }>();
    const {data: organizer} = useGetOrganizer(organizerId);
    const {data: me} = useGetMe();
    const {data: account} = useGetAccount();
    const [showCreateEventModal, setShowCreateEventModal] = useState(false);
    const [periodDays, setPeriodDays] = useState<number | null>(DEFAULT_PERIOD);
    const [notificationsTab, setNotificationsTab] = useState<'all' | 'to_handle'>('all');
    const [showAllNotifications, setShowAllNotifications] = useState(false);
    const [stripeCardDismissed, setStripeCardDismissed] = useState(true);
    const formatOrderDate = useOrderDate();
    const {i18n} = useLingui();

    const [selectedCurrency, setSelectedCurrency] = useState<string | undefined>(organizer?.currency);

    useEffect(() => {
        if (organizer?.currency && !selectedCurrency) {
            setSelectedCurrency(organizer.currency);
        }
    }, [organizer?.currency]);

    const stripeStorageKey = `dehors-stripe-card-dismissed-${account?.id}`;

    useEffect(() => {
        setPeriodDays(readPeriod());
    }, []);

    useEffect(() => {
        if (!account) {
            return;
        }
        try {
            setStripeCardDismissed(localStorage.getItem(stripeStorageKey) === '1');
        } catch {
            setStripeCardDismissed(false);
        }
    }, [account?.id]);

    const choosePeriod = (days: number | null) => {
        setPeriodDays(days);
        try {
            localStorage.setItem(PERIOD_STORAGE_KEY, days === null ? 'all' : String(days));
        } catch {
            // localStorage unavailable
        }
    };

    const dismissStripeCard = () => {
        setStripeCardDismissed(true);
        try {
            localStorage.setItem(stripeStorageKey, '1');
        } catch {
            // localStorage unavailable
        }
    };

    const statsQuery = useGetOrganizerStats(organizerId, selectedCurrency, periodDays);
    const stats = statsQuery.data;
    const currencies = currenciesMap.filter((currency) => stats?.all_organizers_currencies?.includes(currency.value));

    const ordersQuery = useGetOrganizerOrders(organizerId, {
        perPage: 20,
        sortBy: 'created_at',
        sortDirection: 'desc',
    });
    const recentOrders = ordersQuery.data?.data;

    const eventsQuery = useGetEvents(getEventQueryFilters({perPage: 50}) as QueryFilters);
    const events = eventsQuery.data?.data;

    const {
        notifications,
        unreadCount,
        toHandleCount,
        markAllAsRead,
    } = useDashboardNotifications(organizerId as string, events);

    if (!organizer || !stats || !recentOrders || !events) {
        return <DashboardSkeleton/>;
    }

    const currency = selectedCurrency ?? organizer.currency ?? 'CAD';
    // Only when a tax is applied to a ticket (or taxes were already collected).
    const taxNames = stats.tax_names ?? [];
    const showTaxes = taxNames.length > 0 || stats.total_tax > 0;
    const taxNote = new Intl.ListFormat(intlLocale(i18n.locale), {style: 'long', type: 'conjunction'}).format(taxNames);
    const comparison = stats.period_days
        ? comparisonLabel(stats.period_days)
        : (stats.comparison_days ? t`in the last 30 days` : null);
    const showStripeCard = !!account && !account.stripe_connect_setup_complete && !stripeCardDismissed;
    const visibleNotifications = notificationsTab === 'to_handle'
        ? notifications.filter((item) => item.toHandle)
        : notifications;
    const firstName = me?.first_name ?? '';

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <div className={classes.headerText}>
                    <h1 className={classes.title}>{t`Dashboard`}</h1>
                    <p className={classes.subtitle}>
                        <span className={classes.desktopOnly}>
                            {t`Welcome back, ${firstName}! Here's what's happening at ${organizer.name}.`}
                        </span>
                        <span className={classes.mobileOnly}>{t`Welcome back, ${firstName}!`}</span>
                    </p>
                </div>

                <Button
                    className={classes.mobileCreateButton}
                    leftSection={<IconPlus size={20} stroke={2.25}/>}
                    onClick={() => setShowCreateEventModal(true)}
                >
                    {t`Create Event`}
                </Button>

                <div className={classes.headerControls}>
                    {currencies.length > 1 && (
                        <Menu position="bottom-end" width={220} withinPortal>
                            <Menu.Target>
                                <UnstyledButton className={classes.selector}>
                                    {currency}
                                    <img src={icon('chevron-bas')} alt=""/>
                                </UnstyledButton>
                            </Menu.Target>
                            <Menu.Dropdown>
                                {currencies.map((option) => (
                                    <Menu.Item key={option.value} onClick={() => setSelectedCurrency(option.value)}>
                                        {option.value} · {option.label}
                                    </Menu.Item>
                                ))}
                            </Menu.Dropdown>
                        </Menu>
                    )}
                    <Menu position="bottom-end" width={240} withinPortal>
                        <Menu.Target>
                            <UnstyledButton className={classes.selector}>
                                <img src={icon('periode')} alt=""/>
                                {periodLabel(periodDays)}
                                <img src={icon('chevron-bas')} alt=""/>
                            </UnstyledButton>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {PERIODS.map((days) => (
                                <Menu.Item
                                    key={days ?? 'all'}
                                    onClick={() => choosePeriod(days)}
                                    data-selected={days === periodDays || undefined}
                                    className={classes.periodOption}
                                >
                                    {periodLabel(days)}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                </div>
            </header>

            {showStripeCard && (
                <section className={classes.stripeCard}>
                    <span className={classes.stripePastille}><img src={icon('stripe')} alt=""/></span>
                    <div className={classes.stripeText}>
                        <h2>{t`Connect Stripe to receive your payments`}</h2>
                        <p>{t`Sales money goes straight to your account, without waiting for the day of the event.`}</p>
                    </div>
                    <StripeConnectButton className={classes.stripeButton} buttonText={t`Connect Stripe`} buttonIcon={null}/>
                    <UnstyledButton className={classes.stripeClose} onClick={dismissStripeCard} aria-label={t`Hide`}
                                    title={t`Hide`}>
                        <img src={icon('fermer')} alt=""/>
                    </UnstyledButton>
                </section>
            )}

            <section className={classNames(classes.stats, {[classes.statsLoading]: statsQuery.isFetching})}>
                <StatTile
                    tone="sales"
                    iconName="ventes"
                    label={t`Sales`}
                    value={formatCurrency(stats.total_gross_sales, currency)}
                    current={stats.total_gross_sales}
                    previous={stats.previous_total_gross_sales}
                    comparison={comparison}
                    formatAmount={(amount) => formatCurrency(amount, currency)}
                />
                <StatTile
                    tone="products"
                    iconName="produits"
                    label={t`Products Sold`}
                    value={String(formatNumber(stats.total_products_sold))}
                    current={stats.total_products_sold}
                    previous={stats.previous_total_products_sold}
                    comparison={comparison}
                />
                <StatTile
                    tone="attendees"
                    iconName="participants"
                    label={t`Attendees`}
                    value={String(formatNumber(stats.total_attendees_registered))}
                    current={stats.total_attendees_registered}
                    previous={stats.previous_total_attendees_registered}
                    comparison={comparison}
                />
                {showTaxes && (
                    <StatTile
                        tone="taxes"
                        iconName="taxes"
                        label={t`Taxes collected`}
                        value={formatCurrency(stats.total_tax, currency)}
                        note={taxNote || undefined}
                    />
                )}
            </section>

            <div className={classes.middle}>
                <section className={classNames(classes.card, classes.eventsCard)}>
                    <SectionTitle link={`/manage/organizer/${organizerId}/events`}>{t`Events`}</SectionTitle>
                    {events.length > 0 ? (
                        <ScrollList className={classes.eventsList}>
                            {events.map((event) => <EventRow key={event.id} event={event}/>)}
                        </ScrollList>
                    ) : (
                        <div className={classes.empty}>
                            <p>{t`No upcoming events. Create your first one to start selling tickets.`}</p>
                            <Button variant="light" onClick={() => setShowCreateEventModal(true)}>
                                {t`Create Event`}
                            </Button>
                        </div>
                    )}
                </section>

                <section className={classNames(classes.card, classes.notificationsCard)}>
                    <div className={classes.sectionTitle}>
                        <h2>
                            {t`Notifications`}
                            {unreadCount > 0 && <span className={classes.countPastille}>{unreadCount}</span>}
                        </h2>
                    </div>
                    <div className={classes.notificationsBar}>
                        <UnstyledButton
                            className={classNames(classes.chip, {[classes.chipActive]: notificationsTab === 'all'})}
                            onClick={() => setNotificationsTab('all')}
                            aria-pressed={notificationsTab === 'all'}
                        >
                            {t`All`}
                        </UnstyledButton>
                        <UnstyledButton
                            className={classNames(classes.chip, {[classes.chipActive]: notificationsTab === 'to_handle'})}
                            onClick={() => setNotificationsTab('to_handle')}
                            aria-pressed={notificationsTab === 'to_handle'}
                        >
                            {t`To handle`}
                            {toHandleCount > 0 && <span className={classes.chipCount}>{toHandleCount}</span>}
                        </UnstyledButton>
                        <span className={classes.spacer}/>
                        {unreadCount > 0 && (
                            <UnstyledButton className={classes.markAllRead} onClick={markAllAsRead}>
                                {t`All read`}
                            </UnstyledButton>
                        )}
                    </div>
                    {visibleNotifications.length > 0 ? (
                        <>
                            <ScrollList
                                className={classNames(classes.notificationsList, {[classes.notificationsExpanded]: showAllNotifications})}>
                                {visibleNotifications.map((notification) => (
                                    <NotificationItem key={notification.id} notification={notification}/>
                                ))}
                            </ScrollList>
                            {visibleNotifications.length > 3 && !showAllNotifications && (
                                <UnstyledButton className={classes.showAllNotifications}
                                                onClick={() => setShowAllNotifications(true)}>
                                    {t`See all notifications`}
                                </UnstyledButton>
                            )}
                        </>
                    ) : (
                        <div className={classes.empty}>
                            <p>{t`Nothing to handle for now.`}</p>
                        </div>
                    )}
                </section>
            </div>

            <section className={classNames(classes.card, classes.ordersCard)}>
                <SectionTitle link={`/manage/organizer/${organizerId}/orders`}>
                    <span className={classes.desktopOnly}>{t`Recent Orders`}</span>
                    <span className={classes.mobileOnly}>{t`Orders`}</span>
                </SectionTitle>
                {recentOrders.length > 0 ? (
                    <>
                        <div className={classes.tableHead}>
                            <span className={classes.colCustomer}>{t`Customer`}</span>
                            <span className={classes.colEvent}>{t`Event`}</span>
                            <span className={classes.colTickets}>{t`Tickets`}</span>
                            <span className={classes.colAmount}>{t`Amount`}</span>
                            <span className={classes.colDate}>{t`Date`}</span>
                            <span className={classes.colStatus}>{t`Status`}</span>
                        </div>
                        <ScrollList className={classes.ordersList}>
                            {recentOrders.map((order) => {
                                const status = orderStatus(order);
                                const name = `${order.first_name} ${order.last_name}`.trim();

                                return (
                                    <NavLink key={order.id}
                                             to={`/manage/event/${order.event_id}/orders#order-${order.id}`}
                                             className={classes.orderRow}>
                                        <span className={classes.colCustomer}>
                                            <span className={classes.avatar}>{getInitials(name || '?')}</span>
                                            <span className={classes.customerText}>
                                                <span className={classes.customerName}>{name}</span>
                                                <span className={classes.orderId}>#{order.public_id}</span>
                                                <span className={classes.orderEventMobile}>{order.event?.title}</span>
                                            </span>
                                        </span>
                                        <span className={classes.colEvent}>{order.event?.title}</span>
                                        <span className={classes.colTickets}>{ticketCount(order)}</span>
                                        <span className={classes.colAmount}>
                                            {formatCurrency(order.total_gross, order.currency)}
                                            <span className={classes.orderDateMobile}>{formatOrderDate(order.created_at)}</span>
                                        </span>
                                        <span className={classes.colDate}>{formatOrderDate(order.created_at)}</span>
                                        <span className={classes.colStatus}>
                                            <span className={classes.tag} data-order={status.tone}>{status.label}</span>
                                        </span>
                                    </NavLink>
                                );
                            })}
                        </ScrollList>
                    </>
                ) : (
                    <div className={classes.empty}>
                        <p>{t`When customers purchase tickets, their orders will appear here.`}</p>
                    </div>
                )}
            </section>

            {showCreateEventModal && (
                <CreateEventModal
                    onClose={() => setShowCreateEventModal(false)}
                    organizerId={organizerId}
                />
            )}
        </div>
    );
};

export default OrganizerDashboard;
