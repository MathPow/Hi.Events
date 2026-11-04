import {useEffect, useState} from "react";
import {Navigate, useParams, useSearchParams} from "react-router";
import {t} from "@lingui/macro";
import {Menu, UnstyledButton} from "@mantine/core";
import classNames from "classnames";
import {useGetOrganizer} from "../../../../queries/useGetOrganizer.ts";
import {useGetOrganizerStats} from "../../../../queries/useGetOrganizerStats.ts";
import {useGetOrganizerEvents} from "../../../../queries/useGetOrganizerEvents.ts";
import {formatCurrency} from "../../../../utilites/currency.ts";
import {formatNumber} from "../../../../utilites/helpers.ts";
import {intlLocale} from "../../../../utilites/intlLocale.ts";
import {OrganizerReportTypes} from "../../../../types.ts";
import {
    comparisonLabel,
    PERIOD_STORAGE_KEY,
    PERIODS,
    periodLabel,
    readPeriod,
    StatTile,
} from "../OrganizerDashboard";
import dashboardClasses from "../OrganizerDashboard/OrganizerDashboard.module.scss";
import {ReportPanel, reportIcon} from "./ReportPanel.tsx";
import {
    CheckInReport,
    EventsPerformanceReport,
    MerchSalesReport,
    ReportContext,
    RevenueReport,
    TaxSummaryReport,
} from "./reportPanels.tsx";
import classes from "./Reports.module.scss";

interface ReportDefinition {
    id: OrganizerReportTypes;
    iconName: string;
    title: string;
    description: string;
    Content: (props: ReportContext) => JSX.Element;
}

/**
 * Les rapports de l'organisateur: les chiffres du tableau de bord en haut (meme periode),
 * puis chaque rapport qui s'ouvre sur place avec sa propre periode, son evenement et son export.
 */
const OrganizerReports = () => {
    const {organizerId} = useParams();
    const [searchParams] = useSearchParams();
    const {data: organizer} = useGetOrganizer(organizerId);
    const [periodDays, setPeriodDays] = useState<number | null>(null);
    const [openReport, setOpenReport] = useState<string | null>(searchParams.get('open'));
    const currency = organizer?.currency ?? 'CAD';
    const statsQuery = useGetOrganizerStats(organizerId, organizer?.currency, periodDays);
    const eventsQuery = useGetOrganizerEvents(organizerId, {perPage: 100, sortBy: 'start_date', sortDirection: 'desc'});
    const stats = statsQuery.data;

    // La periode du tableau de bord, la meme ici.
    useEffect(() => {
        setPeriodDays(readPeriod());
    }, []);

    const choosePeriod = (days: number | null) => {
        setPeriodDays(days);
        try {
            localStorage.setItem(PERIOD_STORAGE_KEY, days === null ? 'all' : String(days));
        } catch {
            // localStorage indisponible
        }
    };

    // Comme au tableau de bord: les taxes seulement si une taxe s'applique a un billet (ou deja percue).
    const taxNames = stats?.tax_names ?? [];
    const showTaxes = taxNames.length > 0 || (stats?.total_tax ?? 0) > 0;
    const taxNote = new Intl.ListFormat(intlLocale(), {style: 'long', type: 'conjunction'}).format(taxNames);
    const comparison = stats?.period_days
        ? comparisonLabel(stats.period_days)
        : (stats?.comparison_days ? t`in the last 30 days` : null);

    const reports: ReportDefinition[] = [
        {
            id: OrganizerReportTypes.RevenueSummary,
            iconName: 'revenus',
            title: t`Revenue summary`,
            description: t`Daily revenue, taxes and refunds for all events.`,
            Content: RevenueReport,
        },
        {
            id: OrganizerReportTypes.EventsPerformance,
            iconName: 'performance',
            title: t`Events performance`,
            description: t`Sales, orders and fill rate per event.`,
            Content: EventsPerformanceReport,
        },
        ...(showTaxes ? [{
            id: OrganizerReportTypes.TaxSummary,
            iconName: 'taxes',
            title: t`Tax summary`,
            description: t`Taxes collected, grouped by type and by event.`,
            Content: TaxSummaryReport,
        }] : []),
        {
            id: OrganizerReportTypes.CheckInSummary,
            iconName: 'presence',
            title: t`Attendance and check-ins`,
            description: t`Attendees checked in at the entrance and attendance rate.`,
            Content: CheckInReport,
        },
        {
            id: OrganizerReportTypes.MerchSales,
            iconName: 'merch',
            title: t`Merch sales`,
            description: t`Products sold with the tickets, to pick up on site.`,
            Content: MerchSalesReport,
        },
    ];

    const context: ReportContext = {
        organizerId,
        currency,
        events: eventsQuery.data?.data ?? [],
    };

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <h1 className={dashboardClasses.title}>{t`Reports`}</h1>
                <p className={dashboardClasses.subtitle}>
                    <span className={classes.desktopOnly}>
                        {t`View and export the figures of all your events. Only completed orders are included.`}
                    </span>
                    <span className={classes.mobileOnly}>{t`Only completed orders are included.`}</span>
                </p>
            </header>

            <section className={classes.section}>
                <div className={classes.sectionHeader}>
                    <h2 className={classes.sectionTitle}>{t({message: 'Overview', context: 'reports section'})}</h2>
                    <Menu position="bottom-end" width={240} withinPortal>
                        <Menu.Target>
                            <UnstyledButton className={dashboardClasses.selector}>
                                <img src={reportIcon('calendrier')} alt="" className={classes.desktopOnly}/>
                                {periodLabel(periodDays)}
                                <img src={reportIcon('chevron-bas')} alt=""/>
                            </UnstyledButton>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {PERIODS.map((days) => (
                                <Menu.Item
                                    key={days ?? 'all'}
                                    onClick={() => choosePeriod(days)}
                                    data-selected={days === periodDays || undefined}
                                    className={dashboardClasses.periodOption}
                                >
                                    {periodLabel(days)}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                </div>

                {!stats ? (
                    <div className={dashboardClasses.stats}>
                        <StatTile loading loadingCompare tone="sales" iconName="ventes" label={t`Sales`} value=""/>
                        <StatTile loading loadingCompare tone="products" iconName="produits" label={t`Products Sold`} value=""/>
                        <StatTile loading loadingCompare tone="attendees" iconName="participants" label={t`Attendees`} value=""/>
                    </div>
                ) : (
                    <div className={classNames(dashboardClasses.stats, {[dashboardClasses.statsLoading]: statsQuery.isFetching})}>
                        <StatTile
                            tone="sales"
                            iconName="ventes"
                            label={t`Sales`}
                            value={formatCurrency(stats.total_gross_sales, currency)}
                            current={stats.total_gross_sales}
                            previous={stats.previous_total_gross_sales}
                            comparison={comparison}
                            formatAmount={(value) => formatCurrency(value, currency)}
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
                    </div>
                )}
            </section>

            <section className={classes.section}>
                <h2 className={classes.sectionTitle}>{t`Detailed reports`}</h2>
                <div className={classes.reports}>
                    {reports.map(({id, iconName, title, description, Content}) => (
                        <ReportPanel
                            key={id}
                            id={id}
                            iconName={iconName}
                            title={title}
                            description={description}
                            open={openReport === id}
                            onToggle={() => setOpenReport((current) => current === id ? null : id)}
                        >
                            <Content {...context}/>
                        </ReportPanel>
                    ))}
                </div>
            </section>
        </div>
    );
};

/** Les anciennes pages de rapport: le rapport s'ouvre maintenant sur place dans Rapports. */
export const ReportRedirect = () => {
    const {organizerId, reportType} = useParams();
    return <Navigate to={`/manage/organizer/${organizerId}/reports?open=${reportType}`} replace/>;
};

export default OrganizerReports;
