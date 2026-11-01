import {Menu, Skeleton, UnstyledButton} from '@mantine/core';
import {t} from '@lingui/macro';
import {DatePickerInput} from "@mantine/dates";
import {IconArrowDown, IconArrowsSort, IconArrowUp} from "@tabler/icons-react";
import React, {useMemo, useRef, useState} from "react";
import {DownloadCsvButton} from "../DownloadCsvButton";
import '@mantine/dates/styles.css';
import {useGetEventReport} from "../../../queries/useGetEventReport.ts";
import {useParams} from "react-router";
import {Event} from "../../../types.ts";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {useStackedTableLabels} from "../../../hooks/useStackedTableLabels.ts";
import classes from './ReportTable.module.scss';

dayjs.extend(utc);
dayjs.extend(timezone);

const reportIcon = (name: string) => `/interface/admin/rapports/${name}.svg`;

interface Column<T> {
    key: keyof T;
    label: string;
    render?: (value: any, row: T) => React.ReactNode;
    sortable?: boolean;
}

interface ReportProps<T> {
    title: string;
    columns: Column<T>[];
    event: Event
    isLoading?: boolean;
    showDateFilter?: boolean;
    defaultStartDate?: Date;
    defaultEndDate?: Date;
    onDateRangeChange?: (range: [Date | null, Date | null]) => void;
    enableDownload?: boolean;
    downloadFileName?: string;
    showCustomDatePicker?: boolean;
    // The report of the route (/report/:reportType) unless given, e.g. when it opens in place.
    reportType?: string;
    // The report's name above its controls; hidden when the report opens under its own heading.
    showTitle?: boolean;
}

type Period = '24h' | '48h' | '7d' | '14d' | '30d' | '90d' | '6m' | 'ytd' | '12m' | 'custom';

const PERIODS: Period[] = ['24h', '48h', '7d', '14d', '30d', '90d', '6m', 'ytd', '12m', 'custom'];

const periodLabel = (period: Period) => ({
    '24h': t`Last 24 hours`,
    '48h': t`Last 48 hours`,
    '7d': t`Last 7 days`,
    '14d': t`Last 14 days`,
    '30d': t`Last 30 days`,
    '90d': t`Last 90 days`,
    '6m': t`Last 6 months`,
    'ytd': t`Year to date`,
    '12m': t`Last 12 months`,
    'custom': t`Custom Range`,
})[period];

// Up to this many columns, phones show each row as a block of « label: value » lines; wider reports
// (daily sales, promo codes) scroll sideways with their first column kept in view.
const MAX_STACKED_COLUMNS = 5;

interface DataTableProps<T> {
    columns: Column<T>[];
    rows: T[];
    sortField: keyof T | null;
    sortDirection: 'asc' | 'desc' | null;
    onSort: (field: keyof T) => void;
}

const DataTable = <T extends Record<string, any>>({columns, rows, sortField, sortDirection, onSort}: DataTableProps<T>) => {
    const tableRef = useRef<HTMLTableElement>(null);
    useStackedTableLabels(tableRef);

    const sortIcon = (field: keyof T) => {
        if (sortField !== field || !sortDirection) return <IconArrowsSort size={14} stroke={2}/>;
        if (sortDirection === 'asc') return <IconArrowUp size={14} stroke={2}/>;
        return <IconArrowDown size={14} stroke={2}/>;
    };

    return (
        <div className={classes.scroll} data-stacked={columns.length <= MAX_STACKED_COLUMNS || undefined}>
            <table className={classes.table} ref={tableRef}>
                <thead>
                <tr>
                    {columns.map((column) => (
                        <th
                            key={String(column.key)}
                            aria-sort={sortField === column.key && sortDirection
                                ? (sortDirection === 'asc' ? 'ascending' : 'descending')
                                : undefined}
                        >
                            {column.sortable ? (
                                <UnstyledButton className={classes.sortButton}
                                                onClick={() => onSort(column.key)}
                                                data-sorted={sortField === column.key && !!sortDirection || undefined}>
                                    {column.label}
                                    {sortIcon(column.key)}
                                </UnstyledButton>
                            ) : column.label}
                        </th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {rows.map((row, index) => (
                    <tr key={index}>
                        {columns.map((column) => (
                            <td key={String(column.key)}>
                                {column.render
                                    ? column.render(row[column.key], row)
                                    : row[column.key]
                                }
                            </td>
                        ))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};

/**
 * An event report: the period (and its custom dates), the CSV export and a sortable table in the
 * look of the organizer reports (pale header row, thin separators; stacked rows on phones).
 */
const ReportTable = <T extends Record<string, any>>({
                                                        title,
                                                        columns,
                                                        showDateFilter = true,
                                                        defaultStartDate = new Date(new Date().setMonth(new Date().getMonth() - 3)),
                                                        defaultEndDate = new Date(),
                                                        onDateRangeChange,
                                                        enableDownload = true,
                                                        downloadFileName = 'report.csv',
                                                        showCustomDatePicker = false,
                                                        event,
                                                        reportType: reportTypeProp,
                                                        showTitle = true,
                                                    }: ReportProps<T>) => {
    const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
        dayjs(defaultStartDate).tz(event.timezone).toDate(),
        dayjs(defaultEndDate).tz(event.timezone).toDate()
    ]);
    const [selectedPeriod, setSelectedPeriod] = useState<Period>('90d');
    const [showDatePickerInput, setShowDatePickerInput] = useState(showCustomDatePicker);
    const [sortField, setSortField] = useState<keyof T | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    const params = useParams();
    const reportType = reportTypeProp ?? params.reportType;
    const reportQuery = useGetEventReport(params.eventId, reportType, dateRange[0], dateRange[1]);
    const data = (reportQuery.data || []) as T[];

    const calculateDateRange = (period: Period): [Date | null, Date | null] => {
        if (period === 'custom') {
            setShowDatePickerInput(true);
            return dateRange;
        }
        setShowDatePickerInput(false);

        let end = dayjs().tz(event.timezone).endOf('day');
        let start = dayjs().tz(event.timezone);

        switch (period) {
            case '24h':
                start = start.startOf('day');
                end = start.endOf('day');
                break;
            case '48h':
                start = start.subtract(1, 'day').startOf('day');
                end = start.endOf('day').add(1, 'day');
                break;
            case '7d':
                start = start.subtract(6, 'day').startOf('day');
                break;
            case '14d':
                start = start.subtract(13, 'day').startOf('day');
                break;
            case '30d':
                start = start.subtract(29, 'day').startOf('day');
                break;
            case '90d':
                start = start.subtract(89, 'day').startOf('day');
                break;
            case '6m':
                start = start.subtract(6, 'month').startOf('day');
                break;
            case 'ytd':
                start = start.startOf('year');
                break;
            case '12m':
                start = start.subtract(12, 'month').startOf('day');
                break;
            default:
                return [null, null];
        }

        return [start.toDate(), end.toDate()];
    };

    const handlePeriodChange = (value: Period) => {
        setSelectedPeriod(value);
        const newRange = calculateDateRange(value);
        setDateRange(newRange);
        onDateRangeChange?.(newRange);
    };

    // The picker gives days (« 2026-10-01 »): from the start of the first to the end of the last,
    // in the event's time zone.
    const handleDateRangeChange = ([start, end]: [string | Date | null, string | Date | null]) => {
        const day = (value: string | Date) => dayjs.tz(dayjs(value).format('YYYY-MM-DD'), event.timezone);
        const tzRange: [Date | null, Date | null] = [
            start ? day(start).startOf('day').toDate() : null,
            end ? day(end).endOf('day').toDate() : null,
        ];

        setDateRange(tzRange);
        onDateRangeChange?.(tzRange);
    };

    const handleSort = (field: keyof T) => {
        if (sortField === field) {
            if (sortDirection === 'asc') setSortDirection('desc');
            else if (sortDirection === 'desc') {
                setSortDirection(null);
                setSortField(null);
            } else setSortDirection('asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => {
            if (!sortField || !sortDirection) return 0;
            const aValue = a[sortField];
            const bValue = b[sortField];

            const aNum = Number(aValue);
            const bNum = Number(bValue);

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc'
                    ? aValue.toLowerCase().localeCompare(bValue.toLowerCase())
                    : bValue.toLowerCase().localeCompare(aValue.toLowerCase());
            }

            return 0;
        });
    }, [data, sortField, sortDirection]);

    const csvHeaders = columns.map(col => col.label);
    const csvData = sortedData.map(row =>
        columns.map(col => {
            const value = row[col.key];
            return typeof value === 'number' ? value.toString() : value;
        })
    );

    const hasRange = !showDateFilter || (!!dateRange[0] && !!dateRange[1]);
    const isEmpty = reportQuery.isFetched && !reportQuery.isLoading && !data.length;

    const exportButton = (className: string) => enableDownload && (
        <DownloadCsvButton
            headers={csvHeaders}
            data={csvData}
            filename={downloadFileName}
            className={`${classes.exportButton} ${className}`}
            leftSection={<img src={reportIcon('exporter')} alt=""/>}
            disabled={!data.length}
        >
            {t`Export (CSV)`}
        </DownloadCsvButton>
    );

    return (
        <div className={classes.report}>
            {showTitle && <h2 className={classes.title}>{title}</h2>}

            {(showDateFilter || enableDownload) && (
                <div className={classes.controls}>
                    <div className={classes.filters}>
                        {showDateFilter && (
                            <Menu position="bottom-start" width={240} withinPortal>
                                <Menu.Target>
                                    <UnstyledButton className={classes.selector}>
                                        <img src={reportIcon('calendrier')} alt=""/>
                                        <span className={classes.selectorText}>{periodLabel(selectedPeriod)}</span>
                                        <img src={reportIcon('chevron-bas')} alt=""/>
                                    </UnstyledButton>
                                </Menu.Target>
                                <Menu.Dropdown className={classes.periodMenu}>
                                    {PERIODS.map((period) => (
                                        <Menu.Item
                                            key={period}
                                            onClick={() => handlePeriodChange(period)}
                                            data-selected={period === selectedPeriod || undefined}
                                            className={classes.menuOption}
                                        >
                                            {periodLabel(period)}
                                        </Menu.Item>
                                    ))}
                                </Menu.Dropdown>
                            </Menu>
                        )}
                        {showDateFilter && showDatePickerInput && (
                            <DatePickerInput
                                type="range"
                                aria-label={t`Custom Range`}
                                placeholder={t`Custom Range`}
                                value={dateRange}
                                onChange={(value) => handleDateRangeChange(value as [string | Date | null, string | Date | null])}
                                minDate={dayjs().subtract(1, 'year').tz(event.timezone).toDate()}
                                maxDate={dayjs().tz(event.timezone).toDate()}
                                valueFormat="D MMM YYYY"
                                leftSection={<img src={reportIcon('calendrier')} alt=""/>}
                                classNames={{root: classes.datePicker, input: classes.datePickerInput}}
                            />
                        )}
                    </div>
                    {exportButton(classes.desktopOnly)}
                </div>
            )}

            {reportQuery.isLoading && (
                <div className={classes.loading}>
                    <Skeleton height={40} radius={12}/>
                    {[0, 1, 2, 3].map((index) => <Skeleton key={index} height={18} radius={9}/>)}
                </div>
            )}

            {!reportQuery.isLoading && (!hasRange || isEmpty) && (
                <div className={classes.empty}>
                    <strong>{hasRange ? t`Nothing to show yet` : t`No data to show. Please select a date range`}</strong>
                    {hasRange && <span>{t`Once you start collecting data, you'll see it here.`}</span>}
                </div>
            )}

            {!reportQuery.isLoading && hasRange && !isEmpty && (
                <DataTable
                    columns={columns}
                    rows={sortedData}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                />
            )}

            {exportButton(classes.mobileOnly)}
        </div>
    );
};

export default ReportTable;
