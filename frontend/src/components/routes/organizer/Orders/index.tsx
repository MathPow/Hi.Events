import {useEffect, useMemo, useState} from "react";
import {NavLink, useParams} from "react-router";
import {Button, Popover, Skeleton, UnstyledButton} from "@mantine/core";
import {useDebouncedValue, useMediaQuery} from "@mantine/hooks";
import {IconCalendarEvent, IconChevronRight, IconClockHour4, IconDownload} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import classNames from "classnames";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import {IdParam, QueryFilterFields, QueryFilterOperator, QueryFilters} from "../../../../types.ts";
import {useGetOrganizerOrders} from "../../../../queries/useGetOrganizerOrders.ts";
import {useGetOrganizerEvents} from "../../../../queries/useGetOrganizerEvents.ts";
import {organizerClient} from "../../../../api/organizer.client.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {getInitials} from "../../../../utilites/helpers.ts";
import {useOrderDate} from "../../../../utilites/orderDate.ts";
import {orderContents, orderStatus} from "../../../../utilites/orderSummary.ts";
import {downloadBinary} from "../../../../utilites/download.ts";
import {showError} from "../../../../utilites/notifications.tsx";
import {usePageDetail} from "../../../layouts/AppLayout/PageStatus.tsx";
import {MenuOption, MenuTrigger, SearchInput} from "../../../common/EventFilters";
import {PublicIcon} from "../../../common/PublicIcon";
import filterClasses from "../../../common/EventFilters/EventFilters.module.scss";
import {Pagination} from "../../../common/Pagination";
import events from "../Events/Events.module.scss";
import settings from "../Settings/Settings.module.scss";
import classes from "./Orders.module.scss";

dayjs.extend(utc);

const PER_PAGE = 10;
// eslint-disable-next-line lingui/no-unlocalized-strings
const PHONE = '(max-width: 767px)';
// eslint-disable-next-line lingui/no-unlocalized-strings
const API_DATE = 'YYYY-MM-DD HH:mm:ss';

type OrdersTab = 'all' | 'completed' | 'pending' | 'refunds';
const TABS: OrdersTab[] = ['all', 'completed', 'pending', 'refunds'];

type OrderDates = 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'THIS_YEAR';
const ORDER_DATES: OrderDates[] = ['ALL', 'TODAY', 'LAST_7_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'THIS_YEAR'];

const tabLabel = (tab: OrdersTab) => ({
    all: t({message: 'All', context: 'orders'}),
    completed: t({message: 'Completed', context: 'orders tab'}),
    pending: t`Pending`,
    refunds: t`Refunds`,
})[tab];

const datesLabel = (dates: OrderDates) => ({
    ALL: t`All dates`,
    TODAY: t`Today`,
    LAST_7_DAYS: t`Last 7 days`,
    LAST_30_DAYS: t`Last 30 days`,
    THIS_MONTH: t`This month`,
    THIS_YEAR: t`This year`,
})[dates];

const datesStart = (dates: Exclude<OrderDates, 'ALL'>) => ({
    TODAY: dayjs().startOf('day'),
    LAST_7_DAYS: dayjs().subtract(7, 'day'),
    LAST_30_DAYS: dayjs().subtract(30, 'day'),
    THIS_MONTH: dayjs().startOf('month'),
    THIS_YEAR: dayjs().startOf('year'),
})[dates];

// The tab as filters on the orders' own columns (the list is joined with the events).
const tabFilters = (tab: OrdersTab): QueryFilterFields => ({
    all: {},
    completed: {
        status: {operator: QueryFilterOperator.Equals, value: 'COMPLETED'},
        refund_status: {operator: QueryFilterOperator.Equals, value: 'null'},
    },
    pending: {status: {operator: QueryFilterOperator.Equals, value: 'AWAITING_OFFLINE_PAYMENT'}},
    refunds: {refund_status: {operator: QueryFilterOperator.NotEquals, value: 'null'}},
})[tab];

const EventsMenu = ({organizerId, value, onChange}: {
    organizerId: IdParam,
    value: number | null,
    onChange: (value: number | null) => void,
}) => {
    const [opened, setOpened] = useState(false);
    const eventsQuery = useGetOrganizerEvents(organizerId, {
        perPage: 100,
        sortBy: 'start_date',
        sortDirection: 'desc',
    });
    const list = eventsQuery.data?.data ?? [];
    const selected = list.find(event => event.id === value);

    return (
        <Popover opened={opened} onChange={setOpened} position="bottom-end" offset={10} width={320}
                 trapFocus classNames={{dropdown: filterClasses.menu}}>
            <Popover.Target>
                <MenuTrigger opened={opened} active={value !== null} onClick={() => setOpened(current => !current)}>
                    <IconCalendarEvent size={18} stroke={2} className={classes.menuIcon}/>
                    <span className={classes.menuLabel}>{selected?.title ?? t`All events`}</span>
                </MenuTrigger>
            </Popover.Target>
            <Popover.Dropdown>
                <div role="radiogroup" aria-label={t`Events`} className={filterClasses.options}>
                    <MenuOption type="radio" name="event" checked={value === null} label={t`All events`}
                                onChange={() => {
                                    onChange(null);
                                    setOpened(false);
                                }}/>
                    {list.map(event => (
                        <MenuOption key={event.id} type="radio" name="event" checked={value === event.id}
                                    label={event.title}
                                    onChange={() => {
                                        onChange(event.id as number);
                                        setOpened(false);
                                    }}/>
                    ))}
                </div>
            </Popover.Dropdown>
        </Popover>
    );
};

const OrderDatesMenu = ({value, onChange}: { value: OrderDates, onChange: (value: OrderDates) => void }) => {
    const [opened, setOpened] = useState(false);

    return (
        <Popover opened={opened} onChange={setOpened} position="bottom-end" offset={10} width={260}
                 trapFocus classNames={{dropdown: filterClasses.menu}}>
            <Popover.Target>
                <MenuTrigger opened={opened} active={value !== 'ALL'} onClick={() => setOpened(current => !current)}>
                    <IconClockHour4 size={18} stroke={2} className={classes.menuIcon}/>
                    <span className={classes.menuLabel}>{value === 'ALL' ? t`Dates` : datesLabel(value)}</span>
                </MenuTrigger>
            </Popover.Target>
            <Popover.Dropdown>
                <div role="radiogroup" aria-label={t`Dates`} className={filterClasses.options}>
                    {ORDER_DATES.map(dates => (
                        <MenuOption key={dates} type="radio" name="order-dates" checked={value === dates}
                                    label={datesLabel(dates)}
                                    onChange={() => {
                                        onChange(dates);
                                        setOpened(false);
                                    }}/>
                    ))}
                </div>
            </Popover.Dropdown>
        </Popover>
    );
};

/**
 * Figma « Admin · Commandes »: every order of the organizer, all events together, opened from the
 * dashboard (« Tout voir »). A row opens the order in its event.
 */
const Orders = () => {
    const {organizerId} = useParams();
    const isMobile = useMediaQuery(PHONE);
    const formatOrderDate = useOrderDate();
    const [search, setSearch] = useState('');
    const [query] = useDebouncedValue(search.trim(), 300);
    const [eventId, setEventId] = useState<number | null>(null);
    const [dates, setDates] = useState<OrderDates>('ALL');
    const [tab, setTab] = useState<OrdersTab>('all');
    const [page, setPage] = useState(1);
    // On phones « Charger plus de commandes » grows the list instead of turning pages.
    const [shown, setShown] = useState(PER_PAGE);
    const [showFilters, setShowFilters] = useState(false);
    const [exporting, setExporting] = useState(false);

    usePageDetail(t`Orders`);

    useEffect(() => {
        setPage(1);
        setShown(PER_PAGE);
    }, [query, eventId, dates, tab]);

    // Search, event and dates: shared by the list, the tab counts and the export.
    const baseFilters = useMemo((): QueryFilterFields => ({
        ...(eventId !== null ? {event_id: {operator: QueryFilterOperator.Equals, value: eventId}} : {}),
        ...(dates !== 'ALL' ? {
            created_at: {
                operator: QueryFilterOperator.GreaterThanOrEquals,
                value: datesStart(dates).utc().format(API_DATE),
            },
        } : {}),
    }), [eventId, dates]);

    const filtersFor = (forTab: OrdersTab, perPage: number, pageNumber = 1): QueryFilters => ({
        pageNumber,
        perPage,
        query: query || undefined,
        sortBy: 'created_at',
        sortDirection: 'desc',
        filterFields: {...baseFilters, ...tabFilters(forTab)},
    });

    const ordersQuery = useGetOrganizerOrders(organizerId as IdParam,
        isMobile ? filtersFor(tab, shown) : filtersFor(tab, PER_PAGE, page));
    const counts = {
        all: useGetOrganizerOrders(organizerId as IdParam, filtersFor('all', 1)).data?.meta?.total,
        completed: useGetOrganizerOrders(organizerId as IdParam, filtersFor('completed', 1)).data?.meta?.total,
        pending: useGetOrganizerOrders(organizerId as IdParam, filtersFor('pending', 1)).data?.meta?.total,
        refunds: useGetOrganizerOrders(organizerId as IdParam, filtersFor('refunds', 1)).data?.meta?.total,
    } satisfies Record<OrdersTab, number | undefined>;

    const orders = ordersQuery.data?.data ?? [];
    const meta = ordersQuery.data?.meta;
    const total = Number(meta?.total ?? 0);
    const lastPage = Number(meta?.last_page ?? 1);
    const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
    const to = Math.min(page * PER_PAGE, total);
    const filtered = !!query || eventId !== null || dates !== 'ALL';

    const exportCsv = async () => {
        setExporting(true);
        try {
            const blob = await organizerClient.exportOrganizerOrders(organizerId as IdParam,
                filtersFor(tab, 15000));
            downloadBinary(blob, `commandes-${dayjs().format('YYYY-MM-DD')}.csv`);
        } catch {
            showError(t`The orders could not be exported. Try again.`);
        } finally {
            setExporting(false);
        }
    };

    if (!organizerId) {
        return null;
    }

    return (
        <div className={events.page}>
            <div className={classes.headerRow}>
                <header className={events.header}>
                    <h1 className={events.title}>{t`Orders`}</h1>
                    <p className={classes.subtitle}>
                        <span className={classes.desktopOnly}>{t`All the orders, all events together.`}</span>
                        <span className={classes.mobileOnly}>{t`All events together.`}</span>
                    </p>
                </header>
                <Button variant="transparent" className={classNames(settings.outlineButton, classes.exportButton)}
                        leftSection={<IconDownload size={20} stroke={2}/>}
                        loading={exporting} disabled={total === 0} onClick={exportCsv}>
                    {t`Export (CSV)`}
                </Button>
            </div>

            <div className={classes.filters}>
                <div className={events.search}>
                    <SearchInput value={search} onChange={setSearch} compact={isMobile}
                                 placeholder={isMobile ? t`Name, email or no.` : t`Search a name, an email or an order number`}
                                 label={t`Search orders`}/>
                    <UnstyledButton
                        className={classNames(events.filterToggle, {[events.filterToggleActive]: showFilters || eventId !== null || dates !== 'ALL'})}
                        onClick={() => setShowFilters(current => !current)}
                        aria-expanded={showFilters}
                        aria-label={t`Filters`}
                    >
                        <PublicIcon name="filtres" size={18}/>
                    </UnstyledButton>
                </div>
                <div className={classNames(classes.menus, {[classes.menusOpen]: showFilters})}>
                    <EventsMenu organizerId={organizerId} value={eventId} onChange={setEventId}/>
                    <OrderDatesMenu value={dates} onChange={setDates}/>
                </div>
            </div>

            <nav className={events.tabs} aria-label={t`Orders`}>
                {TABS.map(item => (
                    <UnstyledButton
                        key={item}
                        className={classNames(events.tab, {[events.tabActive]: item === tab})}
                        aria-current={item === tab ? 'page' : undefined}
                        onClick={() => setTab(item)}
                    >
                        {tabLabel(item)}
                        {counts[item] !== undefined && <span className={events.tabCount}>{counts[item]}</span>}
                    </UnstyledButton>
                ))}
            </nav>

            <section className={classes.card}>
                {ordersQuery.isLoading && (
                    <div className={classes.loading}>
                        {Array.from({length: 4}).map((_, index) => <Skeleton key={index} height={52} radius={12}/>)}
                    </div>
                )}

                {!ordersQuery.isLoading && orders.length === 0 && (
                    <div className={classes.empty}>
                        <p>{filtered || tab !== 'all'
                            ? t`No order matches these filters.`
                            : t`When customers purchase tickets, their orders will appear here.`}</p>
                    </div>
                )}

                {orders.length > 0 && (
                    <>
                        <div className={classNames(classes.row, classes.tableHead)}>
                            <span className={classes.colOrder}>{t`Order`}</span>
                            <span className={classes.colCustomer}>{t`Customer`}</span>
                            <span className={classes.colEvent}>{t`Event`}</span>
                            <span className={classes.colContents}>{t`Contents`}</span>
                            <span className={classes.colAmount}>{t`Amount`}</span>
                            <span className={classes.colStatus}>{t`Status`}</span>
                            <span className={classes.colChevron}/>
                        </div>
                        <div className={classes.list}>
                            {orders.map(order => {
                                const status = orderStatus(order);
                                const name = `${order.first_name ?? ''} ${order.last_name ?? ''}`.trim();
                                const date = formatOrderDate(order.created_at);

                                return (
                                    <NavLink key={order.id}
                                             to={`/manage/event/${order.event_id}/orders#order-${order.id}`}
                                             className={classNames(classes.row, classes.orderRow)}>
                                        <span className={classes.colOrder}>
                                            <span className={classes.orderNumber}>#{order.public_id}</span>
                                            <span className={classes.orderDate}>{date}</span>
                                        </span>
                                        <span className={classes.colCustomer}>
                                            <span className={classes.avatar}>{getInitials(name || '?')}</span>
                                            <span className={classes.customerText}>
                                                <span className={classes.customerName}>{name}</span>
                                                <span className={classes.mobileMeta}>
                                                    #{order.public_id} · {order.event?.title}
                                                </span>
                                                <span className={classNames(classes.tag, classes.mobileTag)}
                                                      data-order={status.tone}>{status.label}</span>
                                            </span>
                                        </span>
                                        <span className={classes.colEvent}>{order.event?.title}</span>
                                        <span className={classes.colContents}>{orderContents(order)}</span>
                                        <span className={classes.colAmount}>
                                            {formatCurrency(order.total_gross, order.currency)}
                                            <span className={classes.mobileDate}>{date}</span>
                                        </span>
                                        <span className={classes.colStatus}>
                                            <span className={classes.tag} data-order={status.tone}>{status.label}</span>
                                        </span>
                                        <IconChevronRight size={20} stroke={2} className={classes.colChevron}/>
                                    </NavLink>
                                );
                            })}
                        </div>

                        <div className={classes.footer}>
                            <span className={classes.range}>
                                {t`${from} to ${to} of ${total} orders`}
                            </span>
                            <Pagination value={page} onChange={setPage} total={lastPage} marginTop={0}/>
                        </div>
                    </>
                )}
            </section>

            {isMobile && orders.length < total && (
                <Button variant="transparent" className={classNames(settings.outlineButton, classes.loadMore)}
                        loading={ordersQuery.isFetching}
                        onClick={() => setShown(current => current + PER_PAGE)}>
                    {t`Load more orders`}
                </Button>
            )}
        </div>
    );
};

export default Orders;
