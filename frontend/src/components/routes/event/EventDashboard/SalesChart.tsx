import {Fragment, useState} from "react";
import {t} from "@lingui/macro";
import {Menu, Skeleton, Tooltip, UnstyledButton} from "@mantine/core";
import {SkeletonLine} from "../../../common/Skeletons";
import {useMediaQuery} from "@mantine/hooks";
import {EventDailyStats, IdParam} from "../../../../types.ts";
import {useGetEventStats} from "../../../../queries/useGetEventStats.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {formatNumber} from "../../../../utilites/helpers.ts";
import {intlLocale} from "../../../../utilites/intlLocale.ts";
import {comparisonLabel} from "../../organizer/OrganizerDashboard";
import classes from "./EventDashboard.module.scss";

const icon = (name: string) => `/interface/admin/tableau/${name}.svg`;

type ChartMode = 'revenue' | 'products';

const PERIODS = [7, 14, 30, 'all'] as const;
type Period = typeof PERIODS[number];

// The stats endpoint's « last N days » presets: twice the period, to compare with the one before.
export const lastDaysPreset = (days: number) => `last_${days}_days`;

// « All time » runs from the event's first sale to today, with nothing before it to compare with.
const statsPreset = (period: Period) => period === 'all' ? 'all_time' : lastDaysPreset(period * 2);

const periodLabel = (period: Period) => ({
    7: t`Last 7 days`,
    14: t`Last 14 days`,
    30: t`Last 30 days`,
    all: t`All time`,
})[period];

const periodComparison = (period: Period) => {
    if (period === 'all') {
        return '';
    }
    return period === 14 ? t`vs the 14 days before` : comparisonLabel(period);
};

// Sales once taxes, fees and refunds are taken off, as on the Rapports page.
export const netOf = (day: EventDailyStats) => Number(day.total_sales_gross) - Number(day.total_tax)
    - Number(day.total_fees) - Number(day.total_refunded);

const valueOf = (day: EventDailyStats, mode: ChartMode) => mode === 'revenue' ? netOf(day) : Number(day.products_sold);

const sum = (days: EventDailyStats[], mode: ChartMode) => days.reduce((total, day) => total + valueOf(day, mode), 0);

// « ↑ +22 % vs les 7 jours avant », nothing without a previous figure to compare with.
export const ChangeBadge = ({current, previous, comparison}: { current: number, previous: number, comparison: string }) => {
    if (!previous) {
        return null;
    }
    const ratio = (current - previous) / Math.abs(previous);
    const percent = new Intl.NumberFormat(intlLocale(), {style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0})
        .format(ratio);

    return (
        <span className={classes.changeBadge} data-down={ratio < 0 || undefined}>
            {ratio < 0 ? '↓' : '↑'} {percent} {comparison}
        </span>
    );
};

const dayOf = (day: EventDailyStats) => {
    const [year, month, date] = day.date.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, date);
};

const MOBILE_BARS = 7;

// Beyond a month of days the columns would be too thin: a column a week, then a column a month.
const MAX_DAY_BARS = 31;
const MAX_WEEK_BARS = 31;

type Bar = { key: string, stats: EventDailyStats, from: Date, to: Date, unit: 'day' | 'week' | 'month' };

const STAT_FIELDS = [
    'total_fees', 'total_tax', 'total_sales_gross', 'products_sold', 'attendees_registered', 'total_refunded',
    'orders_created',
] as const;

const sumDays = (days: EventDailyStats[]): EventDailyStats => {
    const totals = {...days[0]};
    for (const field of STAT_FIELDS) {
        totals[field] = days.reduce((running, day) => running + Number(day[field]), 0);
    }
    return totals;
};

// The days in columns: one a day, or a week (the last one ending today), or a calendar month.
const toBars = (days: EventDailyStats[]): Bar[] => {
    if (days.length <= MAX_DAY_BARS) {
        return days.map((day) => ({key: day.date, stats: day, from: dayOf(day), to: dayOf(day), unit: 'day'}));
    }

    const unit = days.length <= MAX_WEEK_BARS * 7 ? 'week' : 'month';
    const groups: EventDailyStats[][] = [];
    if (unit === 'week') {
        for (let end = days.length; end > 0; end -= 7) {
            groups.unshift(days.slice(Math.max(0, end - 7), end));
        }
    } else {
        for (const day of days) {
            const current = groups[groups.length - 1];
            if (current && current[0].date.slice(0, 7) === day.date.slice(0, 7)) {
                current.push(day);
            } else {
                groups.push([day]);
            }
        }
    }

    return groups.map((group) => ({
        key: group[0].date,
        stats: sumDays(group),
        from: dayOf(group[0]),
        to: dayOf(group[group.length - 1]),
        unit,
    }));
};

// Under a column: « 22 oct. » when the month changes, else the day; a month column, « oct. ».
const barLabel = (bar: Bar, before?: Bar) => {
    if (bar.unit === 'month') {
        const newYear = !before || before.from.getFullYear() !== bar.from.getFullYear();
        return new Intl.DateTimeFormat(intlLocale(), newYear ? {month: 'short', year: 'numeric'} : {month: 'short'})
            .format(bar.from);
    }
    return !before || before.from.getMonth() !== bar.from.getMonth()
        ? new Intl.DateTimeFormat(intlLocale(), {day: 'numeric', month: 'short'}).format(bar.from)
        : String(bar.from.getDate());
};

// Over a column, on hover: « jeudi 29 octobre », « 29 octobre – 4 novembre » or « octobre 2026 ».
const barTitle = (bar: Bar) => {
    if (bar.unit === 'day') {
        return new Intl.DateTimeFormat(intlLocale(), {weekday: 'long', day: 'numeric', month: 'long'}).format(bar.from);
    }
    if (bar.unit === 'week') {
        return new Intl.DateTimeFormat(intlLocale(), {day: 'numeric', month: 'long'}).formatRange(bar.from, bar.to);
    }
    return new Intl.DateTimeFormat(intlLocale(), {month: 'long', year: 'numeric'}).format(bar.from);
};

type DetailRow = { label: string, value: string, hidden?: boolean };

// The rest of a column under the chart's figure: in revenue, the gross sales and what comes off them
// (when something does), then the orders; in products, the orders and the revenue they brought.
const dayDetails = (day: EventDailyStats, mode: ChartMode, currency: string): DetailRow[][] => {
    const money = (value: number) => formatCurrency(value, currency);
    const count = (value: number) => String(formatNumber(value));
    const deductions: DetailRow[] = [
        {label: t`Taxes`, amount: Number(day.total_tax)},
        {label: t`Fees`, amount: Number(day.total_fees)},
        {label: t`Refunds`, amount: Number(day.total_refunded)},
    ].filter(({amount}) => amount !== 0).map(({label, amount}) => ({label, value: money(-amount)}));
    const orders: DetailRow = {label: t`Orders`, value: count(Number(day.orders_created))};
    const attendees: DetailRow = {
        label: t`Attendees`,
        value: count(Number(day.attendees_registered)),
        hidden: !Number(day.attendees_registered),
    };

    const sections: DetailRow[][] = mode === 'revenue'
        ? [
            deductions.length ? [{label: t`Gross sales`, value: money(Number(day.total_sales_gross))}, ...deductions] : [],
            [
                orders,
                {label: t`Products sold`, value: count(Number(day.products_sold)), hidden: !Number(day.products_sold)},
                attendees,
            ],
        ]
        : [[orders, attendees, {label: t`Net revenue`, value: money(netOf(day)), hidden: !netOf(day)}]];

    return sections.map((rows) => rows.filter((row) => !row.hidden)).filter((rows) => rows.length > 0);
};

/**
 * « Ventes »: the net revenue (or the products sold) of each day of the period in columns (each week or
 * month over a long period), today in full orange, with the total and its change against the period before.
 */
export const SalesChart = ({eventId, currency, loading = false}: { eventId: IdParam, currency: string, loading?: boolean }) => {
    const [mode, setMode] = useState<ChartMode>('revenue');
    const [period, setPeriod] = useState<Period>(14);
    const isPhone = useMediaQuery('(max-width: 767px)');
    const statsQuery = useGetEventStats(eventId, statsPreset(period));
    const data = loading ? undefined : statsQuery.data;
    const allDays = data?.daily_stats ?? [];
    const days = period === 'all' ? allDays : allDays.slice(-period);
    const previousDays = period === 'all' ? [] : allDays.slice(0, Math.max(0, allDays.length - period));

    const total = sum(days, mode);
    const previous = sum(previousDays, mode);
    const bars = toBars(days);
    const visibleBars = isPhone ? bars.slice(-MOBILE_BARS) : bars;
    const highest = Math.max(...visibleBars.map((bar) => valueOf(bar.stats, mode)), 0);
    const format = (value: number) => mode === 'revenue' ? formatCurrency(value, currency) : String(formatNumber(value));

    return (
        <section className={classes.card}>
            <div className={classes.chartHead}>
                <h2 className={classes.sectionHeading}>{t`Sales`}</h2>
                <div className={classes.chartControls}>
                    <UnstyledButton className={classes.chip} aria-pressed={mode === 'revenue'} onClick={() => setMode('revenue')}>
                        {t({message: 'Revenue', context: 'sales chart'})}
                    </UnstyledButton>
                    <UnstyledButton className={classes.chip} aria-pressed={mode === 'products'} onClick={() => setMode('products')}>
                        {t`Products sold`}
                    </UnstyledButton>
                    <Menu position="bottom-end" width={220} withinPortal>
                        <Menu.Target>
                            <UnstyledButton className={classes.chip}>
                                {periodLabel(period)}
                                <img src={icon('chevron-bas')} alt=""/>
                            </UnstyledButton>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {PERIODS.map((option) => (
                                <Menu.Item key={option} onClick={() => setPeriod(option)}
                                           data-selected={option === period || undefined} className={classes.periodOption}>
                                    {periodLabel(option)}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                </div>
            </div>

            <div className={classes.chartPanel} data-loading={(data && statsQuery.isFetching) || undefined}>
                <div className={classes.chartTotalRow}>
                    <div className={classes.chartTotal}>
                        <span>{mode === 'revenue' ? t`Net revenue` : t`Products sold`}</span>
                        {data ? <strong>{format(total)}</strong> : <SkeletonLine width={150} height={36}/>}
                    </div>
                    <ChangeBadge current={total} previous={previous} comparison={periodComparison(period)}/>
                </div>

                {!data ? (
                    <div className={classes.bars} aria-busy>
                        <Skeleton height="100%" radius={12}/>
                    </div>
                ) : (
                    <div className={classes.bars}>
                        {visibleBars.map((bar, index) => {
                            const value = valueOf(bar.stats, mode);
                            const height = highest > 0 ? Math.max(0, value) / highest * 100 : 0;

                            return (
                                <Tooltip key={bar.key} position="top" withArrow arrowSize={8} offset={6}
                                         classNames={{tooltip: classes.barTooltip}}
                                         label={(
                                             <>
                                                 <span className={classes.barTooltipDate}>{barTitle(bar)}</span>
                                                 <span className={classes.barTooltipValue}>
                                                     <i/>{mode === 'revenue' ? t`Net revenue` : t`Products sold`}
                                                     <strong>{format(value)}</strong>
                                                 </span>
                                                 {dayDetails(bar.stats, mode, currency).map((rows, section) => (
                                                     <dl key={section} className={classes.barTooltipRows}>
                                                         {rows.map((row) => (
                                                             <Fragment key={row.label}>
                                                                 <dt>{row.label}</dt>
                                                                 <dd>{row.value}</dd>
                                                             </Fragment>
                                                         ))}
                                                     </dl>
                                                 ))}
                                             </>
                                         )}>
                                    <div className={classes.bar}>
                                        <span className={classes.barTrack}>
                                            <span className={classes.barFill} style={{height: `${height}%`}}
                                                  data-today={index === visibleBars.length - 1 || undefined}/>
                                        </span>
                                        <span className={classes.barLabel}>{barLabel(bar, visibleBars[index - 1])}</span>
                                    </div>
                                </Tooltip>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};
