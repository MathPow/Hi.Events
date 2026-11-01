import classes from "./StatBoxes.module.scss";
import {useGetEventStats} from "../../../queries/useGetEventStats.ts";
import {useParams} from "react-router";
import {t} from "@lingui/macro";
import {useGetEvent} from "../../../queries/useGetEvent.ts";
import {formatCurrency} from "../../../utilites/currency.ts";
import {formatNumber} from "../../../utilites/helpers.ts";
import {intlLocale} from "../../../utilites/intlLocale.ts";
import {ReactNode} from "react";
import classNames from "classnames";

export type StatTone = 'sales' | 'orders' | 'products' | 'attendees' | 'views' | 'refunds' | 'taxes' | 'neutral';

const tableauIcon = (name: string) => `/interface/admin/tableau/${name}.svg`;
const eventIcon = (name: string) => `/interface/admin/evenement/${name}.svg`;

interface ChangeTagProps {
    current: number;
    previous: number;
    // Shows the increase itself when there is nothing to compare a percentage with.
    formatAmount: (amount: number) => string;
}

const ChangeTag = ({current, previous, formatAmount}: ChangeTagProps) => {
    const change = current - previous;
    const label = previous > 0
        ? new Intl.NumberFormat(intlLocale(), {
            style: 'percent',
            signDisplay: 'exceptZero',
            maximumFractionDigits: 0,
        }).format(change / previous)
        : `+${formatAmount(change)}`;

    return (
        <span className={classNames(classes.changeTag, {[classes.changeDown]: change < 0})}>
            {change > 0 && '↑ '}{change < 0 && '↓ '}{label}
        </span>
    );
};

interface StatTileProps {
    tone: StatTone;
    label: string;
    value: ReactNode;
    // An icon of public/interface/admin/tableau, any image, or a node.
    iconName?: string;
    iconSrc?: string;
    icon?: ReactNode;
    current?: number;
    previous?: number | null;
    comparison?: string | null;
    formatAmount?: (amount: number) => string;
    note?: string;
}

/**
 * A figure of the dashboards (Figma « Admin · Tableau de bord »): colored pastille, uppercase label,
 * big FatFrank value, the change against the previous period and a colored band.
 */
export const StatTile = ({
                             tone,
                             iconName,
                             iconSrc,
                             icon,
                             label,
                             value,
                             current,
                             previous,
                             comparison,
                             formatAmount = (amount) => String(formatNumber(amount)),
                             note,
                         }: StatTileProps) => (
    <div className={classes.tile} data-tone={tone}>
        <div className={classes.tileTop}>
            <span className={classes.tilePastille}>
                {icon ?? <img src={iconSrc ?? tableauIcon(iconName ?? 'ventes')} alt=""/>}
            </span>
            <span className={classes.tileLabel}>{label}</span>
        </div>
        <span className={classes.tileValue}>{value}</span>
        {note && <span className={classes.tileNote}>{note}</span>}
        {!note && comparison && current !== undefined && previous !== null && previous !== undefined
            && (current > 0 || previous > 0) && (
                <div className={classes.tileCompare}>
                    <ChangeTag current={current} previous={previous} formatAmount={formatAmount}/>
                    <span className={classes.compareText}>{comparison}</span>
                </div>
            )}
        <span className={classes.tileBand} aria-hidden/>
    </div>
);

// The grid of tiles: 3 per row (6 on very wide screens), 2 on phones. Compact: smaller tiles, as
// many per row as fit (secondary figures of a page, e.g. the deposits).
export const StatGrid = ({children, loading = false, className, compact = false}: {
    children: ReactNode,
    loading?: boolean,
    className?: string,
    compact?: boolean,
}) => (
    <div className={classNames(classes.statistics, {[classes.compact]: compact}, className)}>
        <div className={classNames(classes.grid, {[classes.loading]: loading})}>
            {children}
        </div>
    </div>
);

interface StatBoxProps {
    number: string | number;
    description: string;
    icon: ReactNode;
    // Former per-stat color: the tiles now take the Dehors tones.
    backgroundColor?: string;
    tone?: StatTone;
}

export const StatBox = ({number, description, icon, tone = 'neutral'}: StatBoxProps) => (
    <StatTile tone={tone} icon={icon} label={description} value={number}/>
);

// The event's totals since the start (all time), on its dashboard and its reports.
export const StatBoxes = () => {
    const {eventId} = useParams();
    const eventStatsQuery = useGetEventStats(eventId);
    const eventQuery = useGetEvent(eventId);
    const event = eventQuery?.data;
    const {data: eventStats} = eventStatsQuery;
    const currency = event?.currency;

    return (
        <StatGrid loading={!eventStats}>
            <StatTile
                tone="sales"
                iconName="ventes"
                label={t`Gross sales`}
                value={formatCurrency(eventStats?.total_gross_sales || 0, currency)}
            />
            <StatTile
                tone="orders"
                iconSrc={eventIcon('commandes')}
                label={t`Completed orders`}
                value={formatNumber(eventStats?.total_orders as number)}
            />
            <StatTile
                tone="products"
                iconName="produits"
                label={t`Products sold`}
                value={formatNumber(eventStats?.total_products_sold as number)}
            />
            <StatTile
                tone="attendees"
                iconName="participants"
                label={t`Attendees`}
                value={formatNumber(eventStats?.total_attendees_registered as number)}
            />
            <StatTile
                tone="views"
                iconSrc={eventIcon('vues')}
                label={t`Page views`}
                value={formatNumber(eventStats?.total_views as number)}
            />
            <StatTile
                tone="refunds"
                iconName="remboursement"
                label={t`Refunded`}
                value={formatCurrency(eventStats?.total_refunded as number || 0, currency)}
            />
        </StatGrid>
    );
};
