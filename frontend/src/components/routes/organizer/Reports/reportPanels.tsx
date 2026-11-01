import {useMemo, useState} from "react";
import {t} from "@lingui/macro";
import {useMediaQuery} from "@mantine/hooks";
import {Event, IdParam} from "../../../../types.ts";
import {useGetOrganizerReport} from "../../../../queries/useGetOrganizerReport.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {
    amount,
    barLabel,
    bucketLabel,
    DEFAULT_REPORT_PERIOD,
    formatEventDate,
    formatPercent,
    granularityFor,
    groupRevenue,
    netOf,
    RevenueDay,
    reportRange,
    ReportPeriod,
} from "./reportData.ts";
import {ReportColumn, ReportControls, ReportEmpty, ReportExportButton, ReportLoading, ReportTable} from "./ReportPanel.tsx";
import classes from "./Reports.module.scss";

export interface ReportContext {
    organizerId: IdParam;
    currency: string;
    events: Event[];
}

const MOBILE_QUERY = '(max-width: 767px)';
const MOBILE_BARS = 8;

/** Chaque rapport garde sa periode et son evenement. */
const useReportFilters = () => {
    const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_REPORT_PERIOD);
    const [eventId, setEventId] = useState<IdParam | null>(null);
    const ranges = useMemo(() => reportRange(period), [period]);

    return {period, setPeriod, eventId, setEventId, ...ranges};
};

const totalLabel = (period: ReportPeriod) => period === 365 ? t`Total · 12 months` : t`Total · ${period} days`;

const ChangeBadge = ({current, previous}: { current: number, previous: number }) => {
    if (!previous) {
        return null;
    }
    const ratio = (current - previous) / Math.abs(previous);
    const percent = formatPercent(ratio);

    return (
        <span className={classes.changeBadge} data-down={ratio < 0 || undefined}>
            {ratio < 0 ? '↓' : '↑'} {percent}
            <span className={classes.desktopOnly}> {t`vs previous period`}</span>
        </span>
    );
};

const Meter = ({ratio}: { ratio: number | null }) => (
    <span className={classes.meter} aria-hidden>
        <span style={{width: `${Math.max(0, Math.min(1, ratio ?? 0)) * 100}%`}}/>
    </span>
);

interface RevenueRow {
    key: string;
    label: string;
    gross: number;
    tax: number;
    fee: number;
    refunded: number;
    net: number;
}

/** Résumé des revenus: le net par jour, semaine ou mois en barres, puis le tableau et le total. */
export const RevenueReport = ({organizerId, currency, events}: ReportContext) => {
    const filters = useReportFilters();
    const isMobile = useMediaQuery(MOBILE_QUERY);
    const query = useGetOrganizerReport(organizerId, 'revenue_summary', filters.current.start, filters.current.end, currency, filters.eventId);
    const previousQuery = useGetOrganizerReport(organizerId, 'revenue_summary', filters.previous.start, filters.previous.end, currency, filters.eventId);
    const money = (value: number) => formatCurrency(value, currency);

    const granularity = granularityFor(filters.period);
    const days = (query.data?.data ?? []) as RevenueDay[];
    const buckets = useMemo(() => groupRevenue(days, filters.current, granularity), [days, filters.current, granularity]);
    const totalNet = buckets.reduce((sum, bucket) => sum + bucket.net, 0);
    const previousNet = netOf(previousQuery.data?.data as RevenueDay[] | undefined);
    const hasFees = buckets.some((bucket) => bucket.fee !== 0);
    const hasSales = buckets.some((bucket) => bucket.gross !== 0 || bucket.refunded !== 0);

    const chartBuckets = isMobile ? buckets.slice(-MOBILE_BARS) : buckets;
    const highest = Math.max(...chartBuckets.map((bucket) => bucket.net), 0);

    const rows: RevenueRow[] = [...buckets].reverse().map((bucket) => ({...bucket, label: bucketLabel(bucket, granularity)}));
    const total: RevenueRow = rows.reduce((sum, row) => ({
        ...sum,
        gross: sum.gross + row.gross,
        tax: sum.tax + row.tax,
        fee: sum.fee + row.fee,
        refunded: sum.refunded + row.refunded,
        net: sum.net + row.net,
    }), {key: 'total', label: totalLabel(filters.period), gross: 0, tax: 0, fee: 0, refunded: 0, net: 0});

    const periodColumn = granularity === 'day' ? t`Day` : granularity === 'week' ? t`Week` : t`Month`;
    const columns: ReportColumn<RevenueRow>[] = [
        {label: periodColumn, render: (row) => row.label},
        {label: t`Gross sales`, width: 150, align: 'right', render: (row) => money(row.gross)},
        {label: t`Taxes`, width: 120, align: 'right', render: (row) => money(row.tax)},
        ...(hasFees ? [{label: t`Fees`, width: 110, align: 'right' as const, render: (row: RevenueRow) => money(row.fee)}] : []),
        {label: t`Refunds`, width: 160, align: 'right', render: (row) => money(row.refunded)},
        {label: t`Net`, width: 130, align: 'right', strong: true, render: (row) => money(row.net)},
    ];

    return (
        <>
            <ReportControls
                organizerId={organizerId}
                reportType="revenue_summary"
                currency={currency}
                events={events}
                eventId={filters.eventId}
                onEventChange={filters.setEventId}
                period={filters.period}
                onPeriodChange={filters.setPeriod}
                range={filters.current}
            />
            {query.isLoading ? <ReportLoading/> : (
                <>
                    <div className={classes.chart}>
                        <div className={classes.chartHeader}>
                            <div className={classes.chartTotal}>
                                <span>{t`Net revenue`}</span>
                                <strong>{money(totalNet)}</strong>
                            </div>
                            <ChangeBadge current={totalNet} previous={previousNet}/>
                        </div>
                        <div className={classes.bars} data-loading={query.isFetching || undefined}>
                            {chartBuckets.map((bucket, index) => (
                                <div
                                    key={bucket.key}
                                    className={classes.bar}
                                    title={`${bucketLabel(bucket, granularity)} · ${money(bucket.net)}`}
                                >
                                    <span className={classes.barTrack}>
                                        <span
                                            className={classes.barFill}
                                            data-latest={index === chartBuckets.length - 1 || undefined}
                                            style={{height: highest > 0 && bucket.net > 0 ? `${Math.max(2, bucket.net / highest * 100)}%` : '0%'}}
                                        />
                                    </span>
                                    <span className={classes.barLabel}>
                                        {isMobile && index % 2 === 1 ? ' ' : barLabel(bucket, chartBuckets[index - 1], granularity, isMobile)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {hasSales ? (
                        <ReportTable
                            columns={columns}
                            rows={rows}
                            rowKey={(row) => row.key}
                            total={total}
                            mobile={(row) => {
                                const refunded = money(row.refunded);
                                const gross = money(row.gross);
                                return {
                                    label: row.label,
                                    value: money(row.net),
                                    detail: row.refunded > 0 ? t`${refunded} refunded` : t`${gross} gross`,
                                };
                            }}
                        />
                    ) : (
                        <ReportEmpty>{t`No sales during this period.`}</ReportEmpty>
                    )}
                </>
            )}
            <ReportExportButton organizerId={organizerId} reportType="revenue_summary" currency={currency}
                                eventId={filters.eventId} range={filters.current} className={classes.mobileOnly}/>
        </>
    );
};

interface EventPerformanceRow {
    event_id: number;
    event_name: string;
    start_date: string | null;
    tickets_sold: string | number;
    ticket_capacity: string | number | null;
    total_orders: string | number;
    gross_revenue: string | number;
    total_refunded: string | number;
    total_tax: string | number;
    total_fee: string | number;
}

/** Performance des événements: billets vendus sur la capacite, commandes et ventes par evenement. */
export const EventsPerformanceReport = ({organizerId, currency, events}: ReportContext) => {
    const [eventId, setEventId] = useState<IdParam | null>(null);
    const query = useGetOrganizerReport(organizerId, 'events_performance', null, null, currency, eventId);
    const rows = (query.data?.data ?? []) as EventPerformanceRow[];
    const money = (value: number) => formatCurrency(value, currency);
    const net = (row: EventPerformanceRow) => amount(row.gross_revenue) - amount(row.total_refunded) - amount(row.total_tax) - amount(row.total_fee);
    const tickets = (row: EventPerformanceRow) => row.ticket_capacity !== null && row.ticket_capacity !== undefined
        ? `${amount(row.tickets_sold)} / ${amount(row.ticket_capacity)}`
        : String(amount(row.tickets_sold));

    const columns: ReportColumn<EventPerformanceRow>[] = [
        {
            label: t`Event`,
            render: (row) => (
                <span className={classes.eventCell}>
                    <span>{row.event_name}</span>
                    {row.start_date && <small>{formatEventDate(row.start_date)}</small>}
                </span>
            ),
        },
        {
            label: t`Tickets`,
            width: 170,
            render: (row) => (
                <span className={classes.ticketsCell}>
                    {tickets(row)}
                    {row.ticket_capacity !== null && row.ticket_capacity !== undefined && amount(row.ticket_capacity) > 0 && (
                        <Meter ratio={amount(row.tickets_sold) / amount(row.ticket_capacity)}/>
                    )}
                </span>
            ),
        },
        {label: t`Orders`, width: 110, align: 'right', render: (row) => amount(row.total_orders)},
        {label: t`Gross sales`, width: 140, align: 'right', render: (row) => money(amount(row.gross_revenue))},
        {label: t`Net`, width: 130, align: 'right', strong: true, render: (row) => money(net(row))},
    ];

    return (
        <>
            <ReportControls organizerId={organizerId} reportType="events_performance" currency={currency}
                            events={events} eventId={eventId} onEventChange={setEventId}/>
            {query.isLoading ? <ReportLoading/> : rows.length === 0 ? (
                <ReportEmpty>{t`No events yet.`}</ReportEmpty>
            ) : (
                <ReportTable
                    columns={columns}
                    rows={rows}
                    rowKey={(row) => row.event_id}
                    mobile={(row) => {
                        const sold = tickets(row);
                        return {label: row.event_name, value: money(net(row)), detail: t`${sold} tickets`};
                    }}
                />
            )}
            <ReportExportButton organizerId={organizerId} reportType="events_performance" currency={currency}
                                eventId={eventId} className={classes.mobileOnly}/>
        </>
    );
};

interface TaxRow {
    event_id: number;
    event_name: string;
    tax_name: string;
    total_collected: string | number;
    order_count: string | number;
}

/** Résumé des taxes: les taxes percues, par evenement et par taxe. */
export const TaxSummaryReport = ({organizerId, currency, events}: ReportContext) => {
    const filters = useReportFilters();
    const query = useGetOrganizerReport(organizerId, 'tax_summary', filters.current.start, filters.current.end, currency, filters.eventId);
    const rows = (query.data?.data ?? []) as TaxRow[];
    const money = (value: number) => formatCurrency(value, currency);
    const total: TaxRow = {
        event_id: 0,
        event_name: totalLabel(filters.period),
        tax_name: '',
        total_collected: rows.reduce((sum, row) => sum + amount(row.total_collected), 0),
        order_count: rows.reduce((sum, row) => sum + amount(row.order_count), 0),
    };

    const columns: ReportColumn<TaxRow>[] = [
        {label: t`Event`, render: (row) => row.event_name},
        {label: t`Tax`, width: 160, render: (row) => row.tax_name},
        {label: t`Orders`, width: 120, align: 'right', render: (row) => amount(row.order_count)},
        {label: t`Collected`, width: 150, align: 'right', strong: true, render: (row) => money(amount(row.total_collected))},
    ];

    return (
        <>
            <ReportControls organizerId={organizerId} reportType="tax_summary" currency={currency} events={events}
                            eventId={filters.eventId} onEventChange={filters.setEventId} period={filters.period}
                            onPeriodChange={filters.setPeriod} range={filters.current}/>
            {query.isLoading ? <ReportLoading/> : rows.length === 0 ? (
                <ReportEmpty>{t`No taxes collected during this period.`}</ReportEmpty>
            ) : (
                <ReportTable
                    columns={columns}
                    rows={rows}
                    rowKey={(row) => `${row.event_id}-${row.tax_name}`}
                    total={total}
                    mobile={(row) => ({
                        label: row.event_name,
                        value: money(amount(row.total_collected)),
                        detail: row.tax_name || undefined,
                    })}
                />
            )}
            <ReportExportButton organizerId={organizerId} reportType="tax_summary" currency={currency}
                                eventId={filters.eventId} range={filters.current} className={classes.mobileOnly}/>
        </>
    );
};

interface CheckInRow {
    event_id: number;
    event_name: string;
    start_date: string | null;
    total_attendees: string | number;
    total_checked_in: string | number;
    check_in_rate: string | number;
}

/** Présence et enregistrements: les participants enregistres a l'accueil, par evenement. */
export const CheckInReport = ({organizerId, currency, events}: ReportContext) => {
    const [eventId, setEventId] = useState<IdParam | null>(null);
    const query = useGetOrganizerReport(organizerId, 'check_in_summary', null, null, currency, eventId);
    const rows = (query.data?.data ?? []) as CheckInRow[];
    const rate = (row: CheckInRow) => formatPercent(amount(row.check_in_rate) / 100).replace(/^\+/, '');

    const columns: ReportColumn<CheckInRow>[] = [
        {
            label: t`Event`,
            render: (row) => (
                <span className={classes.eventCell}>
                    <span>{row.event_name}</span>
                    {row.start_date && <small>{formatEventDate(row.start_date)}</small>}
                </span>
            ),
        },
        {label: t`Attendees`, width: 130, align: 'right', render: (row) => amount(row.total_attendees)},
        {label: t`Checked in`, width: 130, align: 'right', render: (row) => amount(row.total_checked_in)},
        {
            label: t`Attendance`,
            width: 200,
            strong: true,
            render: (row) => (
                <span className={classes.rateCell}>
                    <Meter ratio={amount(row.check_in_rate) / 100}/>
                    {rate(row)}
                </span>
            ),
        },
    ];

    return (
        <>
            <ReportControls organizerId={organizerId} reportType="check_in_summary" currency={currency}
                            events={events} eventId={eventId} onEventChange={setEventId}/>
            {query.isLoading ? <ReportLoading/> : rows.length === 0 ? (
                <ReportEmpty>{t`No events yet.`}</ReportEmpty>
            ) : (
                <ReportTable
                    columns={columns}
                    rows={rows}
                    rowKey={(row) => row.event_id}
                    mobile={(row) => {
                        const checkedIn = amount(row.total_checked_in);
                        const attendees = amount(row.total_attendees);
                        return {label: row.event_name, value: rate(row), detail: t`${checkedIn} of ${attendees} checked in`};
                    }}
                />
            )}
            <ReportExportButton organizerId={organizerId} reportType="check_in_summary" currency={currency}
                                eventId={eventId} className={classes.mobileOnly}/>
        </>
    );
};

interface MerchRow {
    event_id: number;
    event_name: string;
    product_id: number;
    product_name: string;
    quantity_sold: string | number;
    gross_sales: string | number;
    order_count: string | number;
}

/** Ventes de merch: les produits vendus avec les billets, par produit et evenement. */
export const MerchSalesReport = ({organizerId, currency, events}: ReportContext) => {
    const filters = useReportFilters();
    const query = useGetOrganizerReport(organizerId, 'merch_sales', filters.current.start, filters.current.end, currency, filters.eventId);
    const rows = (query.data?.data ?? []) as MerchRow[];
    const money = (value: number) => formatCurrency(value, currency);
    const total: MerchRow = {
        event_id: 0,
        event_name: '',
        product_id: 0,
        product_name: totalLabel(filters.period),
        quantity_sold: rows.reduce((sum, row) => sum + amount(row.quantity_sold), 0),
        gross_sales: rows.reduce((sum, row) => sum + amount(row.gross_sales), 0),
        order_count: rows.reduce((sum, row) => sum + amount(row.order_count), 0),
    };

    const columns: ReportColumn<MerchRow>[] = [
        {
            label: t`Product`,
            render: (row) => (
                <span className={classes.eventCell}>
                    <span>{row.product_name}</span>
                    {row.event_name && <small>{row.event_name}</small>}
                </span>
            ),
        },
        {label: t`Quantity`, width: 120, align: 'right', render: (row) => amount(row.quantity_sold)},
        {label: t`Orders`, width: 120, align: 'right', render: (row) => amount(row.order_count)},
        {label: t`Sales`, width: 150, align: 'right', strong: true, render: (row) => money(amount(row.gross_sales))},
    ];

    return (
        <>
            <ReportControls organizerId={organizerId} reportType="merch_sales" currency={currency} events={events}
                            eventId={filters.eventId} onEventChange={filters.setEventId} period={filters.period}
                            onPeriodChange={filters.setPeriod} range={filters.current}/>
            {query.isLoading ? <ReportLoading/> : rows.length === 0 ? (
                <ReportEmpty>{t`No merch sold during this period.`}</ReportEmpty>
            ) : (
                <ReportTable
                    columns={columns}
                    rows={rows}
                    rowKey={(row) => `${row.event_id}-${row.product_id}`}
                    total={total}
                    mobile={(row) => {
                        const quantity = amount(row.quantity_sold);
                        return {label: row.product_name, value: money(amount(row.gross_sales)), detail: t`${quantity} sold`};
                    }}
                />
            )}
            <ReportExportButton organizerId={organizerId} reportType="merch_sales" currency={currency}
                                eventId={filters.eventId} range={filters.current} className={classes.mobileOnly}/>
        </>
    );
};
