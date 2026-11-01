import {ReactNode, useState} from "react";
import {t} from "@lingui/macro";
import {Menu, Skeleton, UnstyledButton} from "@mantine/core";
import {Event, IdParam} from "../../../../types.ts";
import {organizerClient} from "../../../../api/organizer.client.ts";
import {downloadBinary} from "../../../../utilites/download.ts";
import {showError} from "../../../../utilites/notifications.tsx";
import {DateRange, REPORT_PERIODS, ReportPeriod, reportPeriodLabel} from "./reportData.ts";
import classes from "./Reports.module.scss";

export const reportIcon = (name: string) => `/interface/admin/rapports/${name}.svg`;

interface ReportPanelProps {
    id: string;
    iconName: string;
    title: string;
    description: string;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
}

/** Un rapport de la liste: l'en-tete l'ouvre sur place, un 2e clic le referme. */
export const ReportPanel = ({id, iconName, title, description, open, onToggle, children}: ReportPanelProps) => (
    <section className={classes.report} data-open={open || undefined} id={`rapport-${id}`}>
        <UnstyledButton
            className={classes.reportHeader}
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={`rapport-${id}-contenu`}
        >
            <span className={classes.reportPastille}><img src={reportIcon(iconName)} alt=""/></span>
            <span className={classes.reportHeading}>
                <span className={classes.reportTitle}>{title}</span>
                <span className={classes.reportDescription}>{description}</span>
            </span>
            <span className={classes.reportToggle} aria-hidden>
                <img src={reportIcon(open ? 'replier' : 'deplier')} alt=""/>
            </span>
        </UnstyledButton>
        {open && (
            <div className={classes.reportBody} id={`rapport-${id}-contenu`}>
                <p className={classes.reportDescriptionMobile}>{description}</p>
                {children}
            </div>
        )}
    </section>
);

interface ReportControlsProps {
    organizerId: IdParam;
    reportType: string;
    currency: string;
    events: Event[];
    eventId: IdParam | null;
    onEventChange: (eventId: IdParam | null) => void;
    // Seulement pour les rapports dates.
    period?: ReportPeriod;
    onPeriodChange?: (period: ReportPeriod) => void;
    range?: DateRange;
}

/** La periode du rapport, l'evenement et l'export (CSV) avec les memes choix. */
export const ReportControls = ({
                                   organizerId,
                                   reportType,
                                   currency,
                                   events,
                                   eventId,
                                   onEventChange,
                                   period,
                                   onPeriodChange,
                                   range,
                               }: ReportControlsProps) => {
    const selectedEvent = events.find((event) => String(event.id) === String(eventId));

    return (
        <div className={classes.controls}>
            <div className={classes.filters}>
                {period && onPeriodChange && (
                    <Menu position="bottom-start" width={220} withinPortal>
                        <Menu.Target>
                            <UnstyledButton className={classes.selector}>
                                <img src={reportIcon('calendrier')} alt="" className={classes.selectorCalendar}/>
                                <span className={classes.desktopOnly}>{reportPeriodLabel(period)}</span>
                                <span className={classes.mobileOnly}>{reportPeriodLabel(period, true)}</span>
                                <img src={reportIcon('chevron-bas')} alt=""/>
                            </UnstyledButton>
                        </Menu.Target>
                        <Menu.Dropdown>
                            {REPORT_PERIODS.map((days) => (
                                <Menu.Item
                                    key={days}
                                    onClick={() => onPeriodChange(days)}
                                    data-selected={days === period || undefined}
                                    className={classes.menuOption}
                                >
                                    {reportPeriodLabel(days)}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                )}
                <Menu position="bottom-start" width={300} withinPortal>
                    <Menu.Target>
                        <UnstyledButton className={classes.selector}>
                            <span className={classes.selectorText}>
                                {selectedEvent?.title ?? (
                                    <>
                                        <span className={classes.desktopOnly}>{t`All events`}</span>
                                        <span className={classes.mobileOnly}>{t`All`}</span>
                                    </>
                                )}
                            </span>
                            <img src={reportIcon('chevron-bas')} alt=""/>
                        </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown className={classes.eventMenu}>
                        <Menu.Item onClick={() => onEventChange(null)} data-selected={!eventId || undefined}
                                   className={classes.menuOption}>
                            {t`All events`}
                        </Menu.Item>
                        {events.map((event) => (
                            <Menu.Item
                                key={event.id}
                                onClick={() => onEventChange(event.id as IdParam)}
                                data-selected={String(event.id) === String(eventId) || undefined}
                                className={classes.menuOption}
                            >
                                {event.title}
                            </Menu.Item>
                        ))}
                    </Menu.Dropdown>
                </Menu>
            </div>
            <ReportExportButton
                organizerId={organizerId}
                reportType={reportType}
                currency={currency}
                eventId={eventId}
                range={range}
                className={classes.desktopOnly}
            />
        </div>
    );
};

interface ReportExportButtonProps {
    organizerId: IdParam;
    reportType: string;
    currency: string;
    eventId: IdParam | null;
    range?: DateRange;
    className?: string;
}

/** Le rapport en CSV, avec la periode et l'evenement choisis (en haut; en bas sur telephone). */
export const ReportExportButton = ({organizerId, reportType, currency, eventId, range, className}: ReportExportButtonProps) => {
    const [exporting, setExporting] = useState(false);

    const exportCsv = async () => {
        setExporting(true);
        try {
            const csv = await organizerClient.exportOrganizerReport(
                organizerId,
                reportType,
                range?.start.toISOString(),
                range?.end.toISOString(),
                currency,
                eventId,
            );
            downloadBinary(csv, `${reportType}.csv`);
        } catch {
            showError(t`The export failed. Please try again.`);
        } finally {
            setExporting(false);
        }
    };

    return (
        <UnstyledButton className={`${classes.exportButton} ${className ?? ''}`} onClick={exportCsv} disabled={exporting}>
            <img src={reportIcon('exporter')} alt=""/>
            {exporting ? t`Exporting…` : t`Export (CSV)`}
        </UnstyledButton>
    );
};

export interface ReportColumn<T> {
    label: string;
    render: (row: T) => ReactNode;
    // Largeur fixe des colonnes de chiffres (la premiere prend le reste).
    width?: number;
    align?: 'right';
    strong?: boolean;
}

interface ReportTableProps<T> {
    columns: ReportColumn<T>[];
    rows: T[];
    rowKey: (row: T) => string | number;
    // Sur telephone: le libelle a gauche, le chiffre principal et une precision a droite.
    mobile: (row: T) => { label: ReactNode, value: ReactNode, detail?: ReactNode };
    total?: T;
}

export function ReportTable<T>({columns, rows, rowKey, mobile, total}: ReportTableProps<T>) {
    // Une grille CSS, pas un texte a traduire.
    // eslint-disable-next-line lingui/no-unlocalized-strings
    const template = columns.map((column) => column.width ? `${column.width}px` : 'minmax(0, 1fr)').join(' ');

    const row = (item: T, isTotal: boolean) => {
        const summary = mobile(item);
        return (
            <div key={isTotal ? 'total' : rowKey(item)} className={classes.tableRow} data-total={isTotal || undefined}
                 role="row">
                <div className={classes.tableCells} style={{gridTemplateColumns: template}}>
                    {columns.map((column, index) => (
                        <div
                            key={index}
                            role="cell"
                            className={classes.tableCell}
                            data-align={column.align}
                            data-strong={column.strong || undefined}
                        >
                            {column.render(item)}
                        </div>
                    ))}
                </div>
                <div className={classes.tableMobile} aria-hidden>
                    <span className={classes.tableMobileLabel}>{summary.label}</span>
                    <span className={classes.tableMobileValue}>
                        <strong>{summary.value}</strong>
                        {summary.detail && <span>{summary.detail}</span>}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className={classes.table} role="table">
            <div className={classes.tableHead} style={{gridTemplateColumns: template}} role="row">
                {columns.map((column, index) => (
                    <div key={index} role="columnheader" data-align={column.align}>{column.label}</div>
                ))}
            </div>
            {rows.map((item) => row(item, false))}
            {total && row(total, true)}
        </div>
    );
}

export const ReportLoading = () => (
    <div className={classes.loading}>
        <Skeleton height={44} radius="xl" width="40%"/>
        <Skeleton height={180} radius={24}/>
        <Skeleton height={120} radius="md"/>
    </div>
);

export const ReportEmpty = ({children}: { children: ReactNode }) => (
    <p className={classes.empty}>{children}</p>
);
