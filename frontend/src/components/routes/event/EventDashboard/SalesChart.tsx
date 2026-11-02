import {useState} from "react";
import {t} from "@lingui/macro";
import {Menu, Skeleton, UnstyledButton} from "@mantine/core";
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

const PERIODS = [7, 14, 30] as const;
type Period = typeof PERIODS[number];

// The stats endpoint's « last N days » presets: twice the period, to compare with the one before.
export const lastDaysPreset = (days: number) => `last_${days}_days`;

const periodLabel = (days: Period) => ({
    7: t`Last 7 days`,
    14: t`Last 14 days`,
    30: t`Last 30 days`,
})[days];

const periodComparison = (days: Period) => days === 14 ? t`vs the 14 days before` : comparisonLabel(days);

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

/**
 * « Ventes »: the net revenue (or the products sold) of each day of the period in columns, today in
 * full orange, with the total and its change against the period before.
 */
export const SalesChart = ({eventId, currency}: { eventId: IdParam, currency: string }) => {
    const [mode, setMode] = useState<ChartMode>('revenue');
    const [period, setPeriod] = useState<Period>(14);
    const isPhone = useMediaQuery('(max-width: 767px)');
    const statsQuery = useGetEventStats(eventId, lastDaysPreset(period * 2));
    const allDays = statsQuery.data?.daily_stats ?? [];
    const days = allDays.slice(-period);
    const previousDays = allDays.slice(0, Math.max(0, allDays.length - period));

    const total = sum(days, mode);
    const previous = sum(previousDays, mode);
    const visibleDays = isPhone ? days.slice(-MOBILE_BARS) : days;
    const highest = Math.max(...visibleDays.map((day) => valueOf(day, mode)), 0);
    const format = (value: number) => mode === 'revenue' ? formatCurrency(value, currency) : String(formatNumber(value));
    const dayLabel = (date: Date, index: number) => date.getDate() === 1 || index === 0
        ? new Intl.DateTimeFormat(intlLocale(), {day: 'numeric', month: 'short'}).format(date)
        : String(date.getDate());

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
                            {PERIODS.map((days) => (
                                <Menu.Item key={days} onClick={() => setPeriod(days)}
                                           data-selected={days === period || undefined} className={classes.periodOption}>
                                    {periodLabel(days)}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                </div>
            </div>

            <div className={classes.chartPanel} data-loading={statsQuery.isFetching || undefined}>
                <div className={classes.chartTotalRow}>
                    <div className={classes.chartTotal}>
                        <span>{mode === 'revenue' ? t`Net revenue` : t`Products sold`}</span>
                        <strong>{statsQuery.data ? format(total) : '…'}</strong>
                    </div>
                    <ChangeBadge current={total} previous={previous} comparison={periodComparison(period)}/>
                </div>

                {!statsQuery.data ? <Skeleton height={200} radius={12}/> : (
                    <div className={classes.bars}>
                        {visibleDays.map((day, index) => {
                            const value = valueOf(day, mode);
                            const date = dayOf(day);
                            const label = dayLabel(date, index);
                            const height = highest > 0 ? Math.max(0, value) / highest * 100 : 0;

                            return (
                                <div key={day.date} className={classes.bar}
                                     title={`${new Intl.DateTimeFormat(intlLocale(), {weekday: 'short', day: 'numeric', month: 'short'}).format(date)} · ${format(value)}`}>
                                    <span className={classes.barTrack}>
                                        <span className={classes.barFill} style={{height: `${height}%`}}
                                              data-today={index === visibleDays.length - 1 || undefined}/>
                                    </span>
                                    <span className={classes.barLabel}>{label}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};
