import {useState} from "react";
import {Navigate, useParams, useSearchParams} from "react-router";
import {t} from "@lingui/macro";
import {ReportTypes} from "../../../../types.ts";
import {StatBoxes} from "../../../common/StatBoxes";
import {ReportPanel} from "../../organizer/Reports/ReportPanel.tsx";
import ProductSalesReport from "./ProductSalesReport";
import {DailySalesReport} from "./DailySalesReport";
import PromoCodesReport from "./PromoCodesReport";
import classes from './Reports.module.scss';

interface ReportDefinition {
    id: ReportTypes;
    iconName: string;
    title: string;
    description: string;
    Content: (props: { showTitle?: boolean }) => JSX.Element | null;
}

/**
 * The event's reports, like the organizer's (Figma « Admin · Rapports »): the event's figures,
 * then each report opening in place with its period, its table and its CSV export.
 */
const Reports = () => {
    const [searchParams] = useSearchParams();
    const [openReport, setOpenReport] = useState<string | null>(searchParams.get('open'));

    const reports: ReportDefinition[] = [
        {
            id: ReportTypes.ProductSales,
            iconName: 'merch',
            title: t`Product Sales`,
            description: t`Product sales, revenue, and tax breakdown`,
            Content: ProductSalesReport,
        },
        {
            id: ReportTypes.DailySales,
            iconName: 'calendrier',
            title: t`Daily sales`,
            description: t`Daily sales, tax, and fee breakdown`,
            Content: DailySalesReport,
        },
        {
            id: ReportTypes.PromoCodes,
            iconName: 'promo',
            title: t`Promo Codes`,
            description: t`Promo code usage and discount breakdown`,
            Content: PromoCodesReport,
        },
    ];

    return (
        <div className={classes.page}>
            <header className={classes.header}>
                <h1 className={classes.title}>{t`Reports`}</h1>
                <p className={classes.subtitle}>
                    <span className={classes.desktopOnly}>
                        {t`Download sales, attendee, and financial reports for all completed orders.`}
                    </span>
                    <span className={classes.mobileOnly}>{t`Only completed orders are included.`}</span>
                </p>
            </header>

            <section className={classes.section}>
                <h2 className={classes.sectionTitle}>{t({message: 'Overview', context: 'reports section'})}</h2>
                <StatBoxes/>
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
                            <Content showTitle={false}/>
                        </ReportPanel>
                    ))}
                </div>
            </section>
        </div>
    )
}

/** The former report pages: the report now opens in place in Reports. */
export const ReportRedirect = () => {
    const {eventId, reportType} = useParams();
    return <Navigate to={`/manage/event/${eventId}/reports?open=${reportType}`} replace/>;
};

export default Reports;
