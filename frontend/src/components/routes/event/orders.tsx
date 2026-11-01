import React, {useState} from "react";
import {useParams} from "react-router";
import {Button} from "@mantine/core";
import {IconDownload} from "@tabler/icons-react";
import {t} from "@lingui/macro";
import {useGetEvent} from "../../../queries/useGetEvent";
import {useGetEventOrders} from "../../../queries/useGetEventOrders";
import {PageTitle} from "../../common/PageTitle";
import {PageBody} from "../../common/PageBody";
import {OrdersTable} from "../../common/OrdersTable";
import {SearchBarWrapper} from "../../common/SearchBar";
import {Pagination} from "../../common/Pagination";
import {ToolBar} from "../../common/ToolBar";
import {useFilterQueryParamSync} from "../../../hooks/useFilterQueryParamSync";
import {IdParam, QueryFilterCondition, QueryFilterOperator, QueryFilters} from "../../../types";
import {TableSkeleton} from "../../common/TableSkeleton";
import {orderClient} from "../../../api/order.client";
import {downloadBinary} from "../../../utilites/download";
import {FilterModal, FilterOption} from "../../common/FilterModal";
import {withLoadingNotification} from "../../../utilites/withLoadingNotification.tsx";
import {FilterChips} from "../../common/FilterChips";

type StatusChip = 'ALL' | 'COMPLETED' | 'AWAITING_OFFLINE_PAYMENT' | 'CANCELLED';

const conditionValue = (condition: QueryFilterCondition | QueryFilterCondition[] | undefined) =>
    Array.isArray(condition) ? condition[0]?.value : condition?.value;

const asList = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map(String);
    }
    return value ? String(value).split(',') : [];
};

// Functions: the labels are translated once the language is active, not when the module loads.
const orderStatuses = () => [
    {label: t`Completed`, value: 'COMPLETED'},
    {label: t`Cancelled`, value: 'CANCELLED'},
    {label: t`Awaiting Offline Payment`, value: 'AWAITING_OFFLINE_PAYMENT'},
];

const refundStatuses = () => [
    {label: t`Refunded`, value: 'REFUNDED'},
    {label: t`Partially Refunded`, value: 'PARTIALLY_REFUNDED'},
];

export const Orders: React.FC = () => {
    const {eventId} = useParams<{ eventId: string }>();
    const {data: event} = useGetEvent(eventId);
    const [searchParams, setSearchParams] = useFilterQueryParamSync();
    const ordersQuery = useGetEventOrders(eventId, searchParams as QueryFilters);
    const orders = ordersQuery?.data?.data;
    const pagination = ordersQuery?.data?.meta;
    const [downloadPending, setDownloadPending] = useState(false);
    // Offline payments to confirm: the count bubble of their chip.
    const awaitingQuery = useGetEventOrders(eventId, {
        pageNumber: 1,
        perPage: 1,
        filterFields: {status: {operator: QueryFilterOperator.In, value: 'AWAITING_OFFLINE_PAYMENT'}},
    });
    const awaitingCount = Number(awaitingQuery.data?.meta?.total) || 0;

    const filterOptions: FilterOption[] = [
        {
            field: 'status',
            label: t`Order Status`,
            type: 'multi-select',
            options: orderStatuses()
        },
        {
            field: 'refund_status',
            label: t`Refund Status`,
            type: 'multi-select',
            options: refundStatuses()
        }
    ];

    const handleFilterChange = (values: Record<string, string[]>) => {
        const newFilters = {
            ...searchParams,
            filterFields: {
                ...(searchParams.filterFields || {}),
                status: values.status?.length > 0
                    ? {operator: QueryFilterOperator.In, value: values.status}
                    : undefined,
                refund_status: values.refund_status?.length > 0
                    ? {operator: QueryFilterOperator.In, value: values.refund_status}
                    : undefined
            }
        };

        setSearchParams(newFilters as QueryFilters, true); // Added true to replace instead of merge
    };

    const handleResetFilters = () => {
        const clearedFilters = {
            ...searchParams,
            filterFields: {}
        };
        setSearchParams(clearedFilters as QueryFilters, true); // Added true to replace instead of merge
    };

    const handleExport = async (eventId: IdParam) => {
        await withLoadingNotification(async () => {
                setDownloadPending(true);
                const blob = await orderClient.exportOrders(eventId);
                downloadBinary(blob, 'orders.xlsx');
            },
            {
                loading: {
                    title: t`Exporting Orders`,
                    message: t`Please wait while we prepare your orders for export...`
                },
                success: {
                    title: t`Orders Exported`,
                    message: t`Your orders have been exported successfully.`,
                    onRun: () => setDownloadPending(false)
                },
                error: {
                    title: t`Failed to export orders`,
                    message: t`Please try again.`,
                    onRun: () => setDownloadPending(false)
                }
            });
    };

    const currentFilters = {
        status: conditionValue(searchParams.filterFields?.status) || [],
        refund_status: conditionValue(searchParams.filterFields?.refund_status) || []
    };

    const selectedStatuses = asList(conditionValue(searchParams.filterFields?.status));
    const statusChip: StatusChip | null = selectedStatuses.length === 0
        ? 'ALL'
        : (selectedStatuses.length === 1 && ['COMPLETED', 'AWAITING_OFFLINE_PAYMENT', 'CANCELLED'].includes(selectedStatuses[0])
            ? selectedStatuses[0] as StatusChip
            : null);

    const handleStatusChip = (chip: StatusChip) => {
        setSearchParams({
            ...searchParams,
            pageNumber: 1,
            filterFields: {
                ...(searchParams.filterFields || {}),
                status: chip === 'ALL' ? undefined : {operator: QueryFilterOperator.In, value: [chip]},
            },
        } as QueryFilters, true);
    };

    const statusChips = (
        <FilterChips<StatusChip>
            label={t`Order Status`}
            value={statusChip}
            onChange={handleStatusChip}
            chips={[
                {value: 'ALL', label: t({message: 'All', context: 'orders filter'})},
                {value: 'COMPLETED', label: t({message: 'Completed', context: 'orders filter'})},
                {value: 'AWAITING_OFFLINE_PAYMENT', label: t`Awaiting Payment`, count: awaitingCount},
                {value: 'CANCELLED', label: t({message: 'Cancelled', context: 'orders filter'})},
            ]}
        />
    );

    return (
        <PageBody>
            <PageTitle
                subheading={t`View order details, issue refunds, and resend confirmations.`}
            >{t`Orders`}</PageTitle>
            <ToolBar
                filterComponent={
                    <FilterModal
                        filters={filterOptions}
                        activeFilters={currentFilters}
                        onChange={handleFilterChange}
                        onReset={handleResetFilters}
                        title={t`Filter Orders`}
                    />
                }
                searchComponent={() => (
                    <SearchBarWrapper
                        placeholder={t`Search by name, email, or order #...`}
                        setSearchParams={setSearchParams}
                        searchParams={searchParams}
                        pagination={pagination}
                    />
                )}
            >
                <Button
                    onClick={() => handleExport(eventId)}
                    leftSection={<IconDownload size={18}/>}
                    variant="default"
                    loading={downloadPending}
                >
                    {t`Export`}
                </Button>
            </ToolBar>

            <TableSkeleton isVisible={!orders || ordersQuery.isFetching}/>

            {orders && event && (
                <OrdersTable event={event} orders={orders} toolbar={statusChips}/>
            )}

            {!!orders?.length && (
                <Pagination
                    value={searchParams.pageNumber}
                    onChange={(value) => setSearchParams({pageNumber: value})}
                    total={Number(pagination?.last_page)}
                />
            )}
        </PageBody>
    );
};

export default Orders;
