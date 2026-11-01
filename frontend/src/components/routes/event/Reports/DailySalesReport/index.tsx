import {useParams} from "react-router";
import {t} from "@lingui/macro";
import {useGetEvent} from "../../../../../queries/useGetEvent.ts";
import {formatCurrency} from "../../../../../utilites/currency.ts";
import {formatDateWithLocale} from "../../../../../utilites/dates.ts";
import ReportTable from "../../../../common/ReportTable";
import {ReportTypes} from "../../../../../types.ts";

export const DailySalesReport = ({showTitle = true}: { showTitle?: boolean }) => {
    const {eventId} = useParams();
    const eventQuery = useGetEvent(eventId);
    const event = eventQuery.data;

    if (!event) {
        return null;
    }

    const columns = [
        {
            key: 'date' as const,
            label: t`Date`,
            sortable: true,
            render: (value: string) => formatDateWithLocale(value, 'shortDate', event?.timezone)
        },
        {
            key: 'sales_total_gross' as const,
            label: t`Gross sales`,
            sortable: true,
            render: (value: string) => formatCurrency(value, event?.currency)
        },
        {
            key: 'total_tax' as const,
            label: t`Total Tax`,
            sortable: true,
            render: (value: string) => formatCurrency(value, event?.currency)
        },
        {
            key: 'sales_total_before_additions' as const,
            label: t`Net sales`,
            sortable: true,
            render: (value: string) => formatCurrency(value, event?.currency)
        },
        {
            key: 'products_sold' as const,
            label: t`Products sold`,
            sortable: true
        },
        {
            key: 'orders_created' as const,
            label: t`Completed orders`,
            sortable: true
        },
        {
            key: 'total_fee' as const,
            label: t`Total fees`,
            sortable: true,
            render: (value: string) => formatCurrency(value, event?.currency)
        },
        {
            key: 'total_refunded' as const,
            label: t`Total Refunded`,
            sortable: true,
            render: (value: string) => formatCurrency(value, event?.currency)
        },
        {
            key: 'total_views' as const,
            label: t`Page views`,
            sortable: true
        }
    ];

    return (
        <ReportTable
            title={t`Daily sales`}
            showTitle={showTitle}
            reportType={ReportTypes.DailySales}
            columns={columns}
            isLoading={eventQuery.isLoading}
            downloadFileName="daily_sales_report.csv"
            showDateFilter={true}
            event={event}
        />
    );
};
