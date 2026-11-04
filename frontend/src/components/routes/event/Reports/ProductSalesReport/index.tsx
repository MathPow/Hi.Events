import {useParams} from "react-router";
import {t} from "@lingui/macro";
import {useGetEvent} from "../../../../../queries/useGetEvent.ts";
import {formatCurrency} from "../../../../../utilites/currency.ts";
import ReportTable from "../../../../common/ReportTable";
import {ReportTypes} from "../../../../../types.ts";
import {ReportLoading} from "../../../organizer/Reports/ReportPanel.tsx";

const ProductSalesReport = ({showTitle = true}: { showTitle?: boolean }) => {
    const {eventId} = useParams();
    const eventQuery = useGetEvent(eventId);
    const event = eventQuery.data;

    if (!event) {
        return <ReportLoading/>;
    }

    const columns = [
        {
            key: 'product_title' as const,
            label: t`Product`,
            sortable: true
        },
        {
            key: 'number_sold' as const,
            label: t`Units sold`,
            sortable: true
        },
        {
            key: 'total_gross' as const,
            label: t`Gross sales`,
            sortable: true,
            render: (value: string) => formatCurrency(value, event?.currency)
        },
        {
            key: 'total_tax' as const,
            label: t`Taxes`,
            sortable: true,
            render: (value: string) => formatCurrency(value, event?.currency)
        },
        {
            key: 'total_service_fees' as const,
            label: t`Service fees`,
            sortable: true,
            render: (value: string) => formatCurrency(value, event?.currency)
        }
    ];

    return (
        <ReportTable
            title={t`Product Sales`}
            showTitle={showTitle}
            reportType={ReportTypes.ProductSales}
            columns={columns}
            isLoading={eventQuery.isLoading}
            downloadFileName="product_sales_report.csv"
            event={event}
        />
    );
};

export default ProductSalesReport;
