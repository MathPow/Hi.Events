import {CSSProperties, ReactNode} from "react";
import {Skeleton} from "@mantine/core";
import classNames from "classnames";
import classes from "./Skeletons.module.scss";

/**
 * Loading placeholders shaped like the back-office cards (Figma « Admin »): the page keeps its real
 * titles and frames, only the data waits. Widths vary from row to row so a list reads as a list.
 */

const WIDTHS = ['74%', '58%', '86%', '64%', '78%', '52%'];
export const varied = (index: number, offset = 0) => WIDTHS[(index + offset) % WIDTHS.length];

export const SkeletonLine = ({width = '100%', height = 12}: { width?: number | string, height?: number }) => (
    <Skeleton width={width} height={height} radius={999}/>
);

export const SkeletonCircle = ({size = 36}: { size?: number }) => <Skeleton circle height={size}/>;

export const SkeletonSquare = ({size = 40, radius = 12}: { size?: number, radius?: number }) => (
    <Skeleton width={size} height={size} radius={radius}/>
);

export const SkeletonPill = ({width = 84, height = 26}: { width?: number, height?: number }) => (
    <Skeleton width={width} height={height} radius={999}/>
);

// A title and the line under it (a name and its email, an event and its date…).
export const SkeletonLines = ({index = 0, title = 14, sub = 10, subWidth}: {
    index?: number,
    title?: number,
    sub?: number | null,
    subWidth?: string,
}) => (
    <div className={classes.lines}>
        <SkeletonLine width={varied(index)} height={title}/>
        {sub !== null && <SkeletonLine width={subWidth ?? varied(index, 3)} height={sub}/>}
    </div>
);

export const SkeletonCard = ({children, className, style}: {
    children: ReactNode,
    className?: string,
    style?: CSSProperties,
}) => (
    <div className={classNames(classes.card, className)} style={style}>{children}</div>
);

export type SkeletonColumn = 'person' | 'stacked' | 'text' | 'short' | 'pill' | 'amount' | 'menu';

const COLUMN_WIDTHS: Record<SkeletonColumn, string> = {
    person: 'minmax(11rem, 1.4fr)',
    stacked: 'minmax(8rem, 1fr)',
    text: 'minmax(6rem, 1fr)',
    short: 'minmax(4rem, 0.6fr)',
    pill: '6.5rem',
    amount: '5rem',
    menu: '1.5rem',
};

const TableCell = ({column, index}: { column: SkeletonColumn, index: number }) => {
    switch (column) {
        case 'person':
            return (
                <div className={classes.cell}>
                    <SkeletonCircle/>
                    <SkeletonLines index={index}/>
                </div>
            );
        case 'stacked':
            return <div className={classes.cell}><SkeletonLines index={index + 1}/></div>;
        case 'text':
            return <div className={classes.cell}><SkeletonLine width={varied(index, 2)}/></div>;
        case 'short':
            return <div className={classes.cell}><SkeletonLine width={varied(index, 4)}/></div>;
        case 'pill':
            return <div className={classes.cell}><SkeletonPill width={index % 2 ? 76 : 88}/></div>;
        case 'amount':
            return <div className={classes.cell} data-align="end"><SkeletonLine width={index % 2 ? 44 : 56}/></div>;
        case 'menu':
            return <div className={classes.cell} data-align="end"><SkeletonLine width={16} height={6}/></div>;
    }
};

/**
 * A table card while its rows load: the pale header row, then rows of the given columns. On phones
 * the rows stack like the tables' mobile cards.
 */
export const TableCardSkeleton = ({columns, rows = 6, className}: {
    columns: SkeletonColumn[],
    rows?: number,
    className?: string,
}) => {
    const style = {'--skeleton-columns': columns.map((column) => COLUMN_WIDTHS[column]).join(' ')} as CSSProperties;

    return (
        <div className={classNames(classes.tableCard, className)} aria-busy>
            <div className={classNames(classes.tableHead, classes.desktopOnly)} style={style}>
                {columns.map((column, index) => (
                    <div key={index} className={classes.cell} data-align={column === 'amount' ? 'end' : undefined}>
                        {column !== 'menu' && <SkeletonLine width={column === 'pill' || column === 'amount' ? 44 : 64} height={8}/>}
                    </div>
                ))}
            </div>
            {[...Array(rows)].map((_, row) => (
                <div key={row} className={classNames(classes.tableRow, classes.desktopOnly)} style={style}>
                    {columns.map((column, index) => <TableCell key={index} column={column} index={row + index}/>)}
                </div>
            ))}
            {[...Array(rows)].map((_, row) => (
                <div key={`m${row}`} className={classNames(classes.mobileRow, classes.mobileOnly)}>
                    {columns.includes('person') && <SkeletonCircle/>}
                    <SkeletonLines index={row}/>
                    {columns.includes('pill') && <SkeletonPill width={72}/>}
                </div>
            ))}
        </div>
    );
};

export type SkeletonLeading = 'square' | 'circle' | 'handle' | 'none';
export type SkeletonTrailing = 'pill' | 'amount' | 'chevron' | 'menu' | 'text';

/**
 * Rows of a list card (tickets, check-in lists, accordion sections…): a pastille, a title and its
 * line, then what ends the row.
 */
export const ListRowsSkeleton = ({rows = 3, leading = 'square', trailing = [], plain = false, sub = true}: {
    rows?: number,
    leading?: SkeletonLeading,
    trailing?: SkeletonTrailing[],
    plain?: boolean,
    sub?: boolean,
}) => (
    <div className={classes.list} aria-busy>
        {[...Array(rows)].map((_, row) => (
            <div key={row} className={classes.listRow} data-plain={plain || undefined}>
                {leading === 'handle' && <SkeletonLine width={8} height={16}/>}
                {(leading === 'square' || leading === 'handle') && <SkeletonSquare size={36} radius={999}/>}
                {leading === 'circle' && <SkeletonCircle/>}
                <SkeletonLines index={row} sub={sub ? 10 : null}/>
                {trailing.length > 0 && (
                    <div className={classes.trailing}>
                        {trailing.map((item, index) => {
                            switch (item) {
                                case 'pill':
                                    return <SkeletonPill key={index} width={row % 2 ? 70 : 82} height={24}/>;
                                case 'amount':
                                    return <SkeletonLine key={index} width={row % 2 ? 40 : 52} height={14}/>;
                                case 'text':
                                    return <SkeletonLine key={index} width={row % 2 ? 56 : 68} height={10}/>;
                                case 'chevron':
                                    return <SkeletonCircle key={index} size={26}/>;
                                case 'menu':
                                    return <SkeletonLine key={index} width={16} height={6}/>;
                            }
                        })}
                    </div>
                )}
            </div>
        ))}
    </div>
);

export type SkeletonField = 'half' | 'wide' | 'tall' | 'chips';

/**
 * A settings card while its values load: its heading, then labels over sand fields laid out like
 * the form (half: two per row, wide: full row, tall: a text area, chips: a row of choices).
 */
export const FormCardSkeleton = ({heading, fields = ['half', 'half', 'wide', 'tall'], className}: {
    heading?: ReactNode,
    fields?: SkeletonField[],
    className?: string,
}) => (
    <SkeletonCard className={className}>
        {heading ?? (
            <>
                <SkeletonLine width="32%" height={18}/>
                <div style={{height: 10}}/>
                <SkeletonLine width="56%" height={10}/>
            </>
        )}
        <div className={classes.fields} aria-busy>
            {fields.map((field, index) => (
                <div key={index} className={classes.field} data-wide={field !== 'half' || undefined}>
                    <SkeletonLine width={field === 'half' ? `${28 + (index * 9) % 18}%` : '18%'} height={10}/>
                    {field === 'chips' ? (
                        <div style={{display: 'flex', gap: 8}}>
                            {[64, 104, 60, 58].map((width, chip) => <SkeletonPill key={chip} width={width} height={30}/>)}
                        </div>
                    ) : (
                        <div className={classes.input} data-tall={field === 'tall' || undefined}/>
                    )}
                </div>
            ))}
        </div>
    </SkeletonCard>
);
