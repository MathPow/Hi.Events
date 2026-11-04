import {ReactNode, useEffect, useMemo, useState} from "react";
import {Button, UnstyledButton} from "@mantine/core";
import {useDebouncedValue, useDisclosure, useMediaQuery} from "@mantine/hooks";
import {t} from "@lingui/macro";
import classNames from "classnames";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {Event, EventStats, IdParam, Order, Product, QueryFilterFields, QueryFilterOperator, QueryFilters} from "../../../../types.ts";
import {useGetEventOrders} from "../../../../queries/useGetEventOrders.ts";
import {organizerClient} from "../../../../api/organizer.client.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {getInitials, getProductsFromEvent} from "../../../../utilites/helpers.ts";
import {useOrderDate} from "../../../../utilites/orderDate.ts";
import {orderStatus} from "../../../../utilites/orderSummary.ts";
import {downloadBinary} from "../../../../utilites/download.ts";
import {showError} from "../../../../utilites/notifications.tsx";
import {PageTitle} from "../../../common/PageTitle";
import {Pagination} from "../../../common/Pagination";
import {SearchInput} from "../../../common/EventFilters";
import {ManageOrderModal} from "../../../modals/ManageOrderModal";
import {useUrlHash} from "../../../../hooks/useUrlHash.ts";
import {
    CheckChoice,
    CheckMenu,
    DateRange,
    DateRangeMenu,
    FilterButton,
    FilterSheet,
    ICONS,
    NO_DATES,
    SheetChips,
    SheetDates,
} from "./filters.tsx";
import {OrderRowsSkeleton, InfoTile} from "./index.tsx";
import classes from "./OrdersAndAttendees.module.scss";

dayjs.extend(utc);
dayjs.extend(timezone);

const PER_PAGE = 10;
// eslint-disable-next-line lingui/no-unlocalized-strings
const PHONE = '(max-width: 767px)';
// eslint-disable-next-line lingui/no-unlocalized-strings
const API_DATE = 'YYYY-MM-DD HH:mm:ss';

// The « Statut » choices, as the orders' display_status filter reads them (OrderRepository).
type DisplayStatus = 'COMPLETED' | 'AWAITING_OFFLINE_PAYMENT' | 'REFUNDED' | 'CANCELLED';
const STATUSES: DisplayStatus[] = ['COMPLETED', 'AWAITING_OFFLINE_PAYMENT', 'REFUNDED', 'CANCELLED'];

const statusLabel = (status: DisplayStatus) => ({
    COMPLETED: t({message: 'Completed', context: 'order status'}),
    AWAITING_OFFLINE_PAYMENT: t`Pending`,
    REFUNDED: t({message: 'Refunded', context: 'order status'}),
    CANCELLED: t({message: 'Cancelled', context: 'order status'}),
})[status];

// « 2 × Billet régulier + 1 × Chandail (S, L) »: each product once, its options in parentheses.
const orderItemsLine = (order: Order, products: Map<number, Product>) => {
    const lines = new Map<number, { name: string, quantity: number, options: string[] }>();
    (order.order_items ?? []).forEach((item) => {
        const product = products.get(item.product_id);
        const price = product?.prices?.find((candidate) => candidate.id === item.product_price_id);
        const line = lines.get(item.product_id) ?? {name: product?.title ?? item.item_name, quantity: 0, options: []};
        line.quantity += item.quantity;
        if ((product?.prices?.length ?? 0) > 1 && price?.label && !line.options.includes(price.label)) {
            line.options.push(price.label);
        }
        lines.set(item.product_id, line);
    });

    return [...lines.values()]
        .map(({name, quantity, options}) => `${quantity} × ${name}${options.length ? ` (${options.join(', ')})` : ''}`)
        .join(' + ');
};

const statusTone = (order: Order) => orderStatus(order).tone;

export const OrdersTab = ({event, stats, capsule}: { event: Event, stats?: EventStats, capsule: ReactNode }) => {
    const isMobile = useMediaQuery(PHONE);
    const formatOrderDate = useOrderDate();
    const [search, setSearch] = useState('');
    const [query] = useDebouncedValue(search.trim(), 300);
    const [statuses, setStatuses] = useState<string[]>([]);
    const [dates, setDates] = useState<DateRange>(NO_DATES);
    const [page, setPage] = useState(1);
    // On phones « Charger plus de commandes » grows the list instead of turning pages.
    const [shown, setShown] = useState(PER_PAGE);
    const [sheetOpen, sheet] = useDisclosure(false);
    const [exporting, setExporting] = useState(false);
    const [openOrderId, setOpenOrderId] = useState<IdParam>();

    // From the dashboard and the organizer's Commandes page: /orders#order-12 opens that order.
    useUrlHash(/^#order-(\d+)$/, (matches) => setOpenOrderId(matches![1]));

    useEffect(() => {
        setPage(1);
        setShown(PER_PAGE);
    }, [query, statuses, dates]);

    const products = useMemo(
        () => new Map((getProductsFromEvent(event) ?? []).map((product) => [product.id as number, product])),
        [event],
    );
    // « Depuis la mise en vente »: the first sale start of the event's products, or its first order.
    const firstOrder = useGetEventOrders(event.id, {pageNumber: 1, perPage: 1, sortBy: 'created_at', sortDirection: 'asc'})
        .data?.data?.[0];
    const onSaleSince = useMemo(() => {
        const starts = [...products.values()]
            .map((product) => product.sale_start_date)
            .filter(Boolean)
            .map((date) => dayjs.utc(date as string).tz(event.timezone));
        if (starts.length) {
            return starts.reduce((first, date) => date.isBefore(first) ? date : first);
        }
        return firstOrder ? dayjs.utc(firstOrder.created_at).tz(event.timezone) : dayjs();
    }, [products, firstOrder, event.timezone]);

    // Search and dates: shared by the list, the status counts and the export.
    const baseFilters = useMemo((): QueryFilterFields => {
        if (!dates.start) {
            return {};
        }
        const zone = event.timezone;
        const day = (date: dayjs.Dayjs) => dayjs.tz(date.format('YYYY-MM-DD'), zone);
        return {
            created_at: [
                {operator: QueryFilterOperator.GreaterThanOrEquals, value: day(dates.start).utc().format(API_DATE)},
                {
                    operator: QueryFilterOperator.LessThan,
                    value: day(dates.end ?? dates.start).add(1, 'day').utc().format(API_DATE),
                },
            ],
        };
    }, [dates, event.timezone]);

    const filtersFor = (displayStatuses: string[], perPage: number, pageNumber = 1): QueryFilters => ({
        pageNumber,
        perPage,
        query: query || undefined,
        sortBy: 'created_at',
        sortDirection: 'desc',
        filterFields: {
            ...baseFilters,
            ...(displayStatuses.length ? {display_status: {operator: QueryFilterOperator.In, value: displayStatuses.join(',')}} : {}),
        },
    });

    const ordersQuery = useGetEventOrders(event.id, isMobile ? filtersFor(statuses, shown) : filtersFor(statuses, PER_PAGE, page));
    const statusCounts: Record<DisplayStatus, number | undefined> = {
        COMPLETED: useGetEventOrders(event.id, filtersFor(['COMPLETED'], 1)).data?.meta?.total,
        AWAITING_OFFLINE_PAYMENT: useGetEventOrders(event.id, filtersFor(['AWAITING_OFFLINE_PAYMENT'], 1)).data?.meta?.total,
        REFUNDED: useGetEventOrders(event.id, filtersFor(['REFUNDED'], 1)).data?.meta?.total,
        CANCELLED: useGetEventOrders(event.id, filtersFor(['CANCELLED'], 1)).data?.meta?.total,
    };
    // The tile counts every refunded order of the event, whatever the filters.
    const refundedOrders = useGetEventOrders(event.id, {
        pageNumber: 1,
        perPage: 1,
        filterFields: {display_status: {operator: QueryFilterOperator.In, value: 'REFUNDED'}},
    }).data?.meta?.total;

    const orders = ordersQuery.data?.data ?? [];
    const meta = ordersQuery.data?.meta;
    const total = Number(meta?.total ?? 0);
    const lastPage = Number(meta?.last_page ?? 1);
    const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
    const to = Math.min(page * PER_PAGE, total);
    const filtered = !!query || statuses.length > 0 || !!dates.start;

    const statusChoices: CheckChoice[] = STATUSES.map((status) => ({
        value: status,
        label: statusLabel(status),
        count: statusCounts[status],
    }));

    const netSales = Number(stats?.total_gross_sales ?? 0);
    const refundedAmount = Number(stats?.total_refunded ?? 0);
    const refunded = formatCurrency(refundedAmount, event.currency).replace(/[.,]00(?=\D*$)/, '');
    const orderCount = Number(stats?.total_orders ?? 0);

    const exportCsv = async () => {
        setExporting(true);
        try {
            const filters = filtersFor(statuses, 15000);
            filters.filterFields = {
                ...filters.filterFields,
                event_id: {operator: QueryFilterOperator.Equals, value: event.id as number},
            };
            const blob = await organizerClient.exportOrganizerOrders(event.organizer_id as IdParam, filters);
            downloadBinary(blob, `commandes-${dayjs().format('YYYY-MM-DD')}.csv`);
        } catch {
            showError(t`The orders could not be exported. Try again.`);
        } finally {
            setExporting(false);
        }
    };

    return (
        <>
            <PageTitle
                subheading={t`The orders and the attendees of this event.`}
                mobileSubheading={null}
                actions={(
                    <Button variant="outline" className={classes.desktopOnly} loading={exporting}
                            disabled={total === 0 && !filtered}
                            leftSection={<img src="/interface/admin/commandes/telecharger.svg" width={20} height={20} alt=""/>}
                            onClick={exportCsv}>
                        {t`Export (CSV)`}
                    </Button>
                )}
            >{t`Orders`}</PageTitle>

            {capsule}

            <div className={classes.tiles}>
                <InfoTile loading={!stats} icon={`${ICONS}/dollar.svg`} tone="green" label={t`Net sales`}
                          value={formatCurrency(netSales, event.currency).replace(/[.,]00(?=\D*$)/, '')}/>
                <InfoTile loading={!stats} icon="/interface/admin/produits/sac.svg" tone="orange" label={t`Average order`}
                          value={formatCurrency(orderCount > 0 ? netSales / orderCount : 0, event.currency)}/>
                <InfoTile loading={refundedOrders === undefined} icon={`${ICONS}/remboursement.svg`} tone="neutral" label={t`Refunds`}
                          value={refundedOrders ?? '—'}
                          detail={refundedAmount > 0 ? t`${refunded} refunded` : undefined}/>
            </div>

            <div className={classes.toolbar}>
                <div className={classes.searchLine}>
                    <SearchInput value={search} onChange={setSearch} compact={!!isMobile}
                                 placeholder={isMobile ? t`Name, email or no.` : t`Search a name, an email or an order number`}
                                 label={t`Search orders`}/>
                    <span className={classes.phoneOnly}>
                        <FilterButton active={statuses.length > 0 || !!dates.start} onClick={sheet.open}/>
                    </span>
                </div>
                <div className={classes.desktopMenus}>
                    <CheckMenu icon={`${ICONS}/filtre.svg`} label={t`Status`} heading={t`Status`}
                               choices={statusChoices} value={statuses} onChange={setStatuses}/>
                    <DateRangeMenu value={dates} onChange={setDates} onSaleSince={onSaleSince}/>
                </div>
            </div>

            <section className={classes.card}>
                {ordersQuery.isLoading && <OrderRowsSkeleton/>}

                {!ordersQuery.isLoading && orders.length === 0 && (
                    <p className={classes.empty}>{filtered
                        ? t`No order matches these filters.`
                        : t`When customers purchase tickets, their orders will appear here.`}</p>
                )}

                {orders.length > 0 && (
                    <>
                        <div className={classNames(classes.orderGrid, classes.tableHead)}>
                            <span>{t`Order`}</span>
                            <span>{t`Customer`}</span>
                            <span>{t`Contents`}</span>
                            <span>{t`Amount`}</span>
                            <span>{t`Status`}</span>
                            <span/>
                        </div>
                        <div className={classes.list}>
                            {orders.map((order) => {
                                const status = orderStatus(order);
                                const name = `${order.first_name ?? ''} ${order.last_name ?? ''}`.trim();
                                const date = formatOrderDate(order.created_at);
                                const contents = orderItemsLine(order, products);

                                return (
                                    <UnstyledButton key={order.id} onClick={() => setOpenOrderId(order.id)}
                                                    className={classNames(classes.orderGrid, classes.row)}>
                                        <span className={classes.orderCell}>
                                            <span className={classes.strong}>#{order.public_id}</span>
                                            <span className={classes.small}>{date}</span>
                                        </span>
                                        <span className={classes.personCell}>
                                            <span className={classes.avatar}>{getInitials(name || '?')}</span>
                                            <span className={classes.personText}>
                                                <span className={classes.strong}>{name}</span>
                                                <span className={classNames(classes.small, classes.desktopOnly)}>{order.email}</span>
                                                <span className={classNames(classes.small, classes.phoneOnly)}>
                                                    #{order.public_id} · {contents}
                                                </span>
                                                <span className={classNames(classes.tag, classes.phoneOnly)}
                                                      data-tone={statusTone(order)}>{status.label}</span>
                                            </span>
                                        </span>
                                        <span className={classes.contentsCell}>{contents}</span>
                                        <span className={classes.amountCell}>
                                            {formatCurrency(order.total_gross, order.currency)}
                                            <span className={classNames(classes.small, classes.phoneOnly)}>{date}</span>
                                        </span>
                                        <span className={classes.statusCell}>
                                            <span className={classes.tag} data-tone={statusTone(order)}>{status.label}</span>
                                        </span>
                                        <img src={`${ICONS}/chevron-droite.svg`} width={20} height={20} alt=""
                                             className={classes.chevronCell}/>
                                    </UnstyledButton>
                                );
                            })}
                        </div>

                        <div className={classes.footer}>
                            <span className={classes.range}>{t`${from} to ${to} of ${total} orders`}</span>
                            <Pagination value={page} onChange={setPage} total={lastPage} marginTop={0}/>
                        </div>
                    </>
                )}
            </section>

            {isMobile && orders.length < total && (
                <Button variant="outline" className={classes.loadMore} loading={ordersQuery.isFetching}
                        onClick={() => setShown((current) => current + PER_PAGE)}>
                    {t`Load more orders`}
                </Button>
            )}

            <FilterSheet opened={sheetOpen} onClose={sheet.close} onClear={() => {
                setStatuses([]);
                setDates(NO_DATES);
            }}>
                <h3 className={classes.sheetSection}>{t`Status`}</h3>
                <SheetChips choices={statusChoices} value={statuses} onChange={setStatuses} label={t`Status`}/>
                <h3 className={classes.sheetSection}>{t`Dates`}</h3>
                <SheetDates value={dates} onChange={setDates} onSaleSince={onSaleSince}/>
            </FilterSheet>

            {openOrderId && <ManageOrderModal orderId={openOrderId} onClose={() => setOpenOrderId(undefined)}/>}
        </>
    );
};
