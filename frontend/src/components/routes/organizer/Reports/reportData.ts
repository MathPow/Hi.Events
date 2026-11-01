import {t} from "@lingui/macro";
import dayjs, {Dayjs} from "dayjs";
import {getClientLocale} from "../../../../locales.ts";

// Les periodes d'un rapport date (revenus, taxes, merch): le serveur refuse plus de 370 jours.
export const REPORT_PERIODS = [7, 30, 90, 365] as const;
export type ReportPeriod = typeof REPORT_PERIODS[number];
export const DEFAULT_REPORT_PERIOD: ReportPeriod = 90;

export const reportPeriodLabel = (days: ReportPeriod, short = false): string => {
    if (short) {
        return days === 365 ? t`12 months` : t`${days} days`;
    }
    switch (days) {
        case 7:
            return t`Last 7 days`;
        case 30:
            return t`Last 30 days`;
        case 365:
            return t`Last 12 months`;
        default:
            return t`Last 90 days`;
    }
};

export interface DateRange {
    start: Date;
    end: Date;
}

/** Les N derniers jours, aujourd'hui compris; et les N jours d'avant pour comparer. */
export const reportRange = (days: number): { current: DateRange, previous: DateRange } => {
    const end = dayjs().endOf('day');
    const start = end.subtract(days - 1, 'day').startOf('day');
    const previousEnd = start.subtract(1, 'day').endOf('day');

    return {
        current: {start: start.toDate(), end: end.toDate()},
        previous: {start: previousEnd.subtract(days - 1, 'day').startOf('day').toDate(), end: previousEnd.toDate()},
    };
};

export const amount = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

// Une ligne du rapport « Résumé des revenus » (une par jour).
export interface RevenueDay {
    date: string;
    gross_sales: string | number;
    net_revenue: string | number;
    total_refunded: string | number;
    total_tax: string | number;
    total_fee: string | number;
    order_count: string | number;
}

export type Granularity = 'day' | 'week' | 'month';

export const granularityFor = (days: number): Granularity => days <= 7 ? 'day' : days <= 90 ? 'week' : 'month';

export interface RevenueBucket {
    key: string;
    start: Dayjs;
    end: Dayjs;
    gross: number;
    tax: number;
    fee: number;
    refunded: number;
    net: number;
}

const bucketStart = (date: Dayjs, granularity: Granularity): Dayjs => {
    if (granularity === 'week') {
        // Semaines du lundi au dimanche.
        return date.subtract((date.day() + 6) % 7, 'day');
    }
    return granularity === 'month' ? date.startOf('month') : date;
};

const bucketEnd = (start: Dayjs, granularity: Granularity): Dayjs =>
    granularity === 'week' ? start.add(6, 'day') : granularity === 'month' ? start.endOf('month').startOf('day') : start;

/**
 * Les jours du rapport regroupes par jour, semaine ou mois, du plus ancien au plus recent.
 * Le net est ce qui reste a l'organisateur: ventes brutes moins taxes, frais et remboursements.
 */
export const groupRevenue = (days: RevenueDay[], range: DateRange, granularity: Granularity): RevenueBucket[] => {
    const first = dayjs(range.start).startOf('day');
    const last = dayjs(range.end).startOf('day');
    const buckets = new Map<string, RevenueBucket>();

    // Toutes les periodes, meme vides, pour un graphique sans trou.
    for (let cursor = bucketStart(first, granularity); !cursor.isAfter(last); cursor = bucketEnd(cursor, granularity).add(1, 'day')) {
        const start = cursor.isBefore(first) ? first : cursor;
        const end = bucketEnd(cursor, granularity).isAfter(last) ? last : bucketEnd(cursor, granularity);
        buckets.set(cursor.format('YYYY-MM-DD'), {
            key: cursor.format('YYYY-MM-DD'), start, end, gross: 0, tax: 0, fee: 0, refunded: 0, net: 0,
        });
    }

    days.forEach((day) => {
        const bucket = buckets.get(bucketStart(dayjs(day.date), granularity).format('YYYY-MM-DD'));
        if (!bucket) {
            return;
        }
        bucket.gross += amount(day.gross_sales);
        bucket.tax += amount(day.total_tax);
        bucket.fee += amount(day.total_fee);
        bucket.refunded += amount(day.total_refunded);
    });

    return [...buckets.values()].map((bucket) => ({
        ...bucket,
        net: bucket.gross - bucket.tax - bucket.fee - bucket.refunded,
    }));
};

export const netOf = (days: RevenueDay[] | undefined): number => (days ?? []).reduce(
    (total, day) => total + amount(day.gross_sales) - amount(day.total_tax) - amount(day.total_fee) - amount(day.total_refunded),
    0,
);

const locale = () => getClientLocale();

/** « 19 – 25 oct. », « 28 sept. – 4 oct. », « 31 oct. » ou « octobre 2026 ». */
export const bucketLabel = (bucket: RevenueBucket, granularity: Granularity): string => {
    const start = bucket.start.locale(locale());
    const end = bucket.end.locale(locale());

    if (granularity === 'month') {
        return start.format('MMMM YYYY');
    }
    if (granularity === 'day' || start.isSame(end, 'day')) {
        return start.format('D MMM');
    }
    return start.isSame(end, 'month')
        ? `${start.format('D')} – ${end.format('D MMM')}`
        : `${start.format('D MMM')} – ${end.format('D MMM')}`;
};

/** Sous une barre: le jour, avec le mois au premier et quand il change. */
export const barLabel = (bucket: RevenueBucket, previous: RevenueBucket | undefined, granularity: Granularity, compact = false): string => {
    const start = bucket.start.locale(locale());
    if (granularity === 'month') {
        return start.format('MMM');
    }
    // Sur telephone, les barres sont etroites: le jour seulement.
    return !compact && (!previous || !previous.start.isSame(bucket.start, 'month')) ? start.format('D MMM') : start.format('D');
};

export const formatPercent = (ratio: number): string => new Intl.NumberFormat(
    getClientLocale().startsWith('fr') ? 'fr-CA' : getClientLocale(),
    {style: 'percent', signDisplay: 'exceptZero', maximumFractionDigits: 0},
).format(ratio);

export const formatEventDate = (date: string | null | undefined): string =>
    date ? dayjs(date).locale(locale()).format('D MMM YYYY') : '';
